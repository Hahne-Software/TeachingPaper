// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '../test/render-app';

// jsdom does not measure, so each Block reports the height queued here (default 100). The queue
// is indexed by Block position: a Block that is already in the Worksheet (an Unsupported Block
// from an opened file) takes index 0, so push its height first.
let heights: number[] = [];

beforeEach(() => {
  heights = [];
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.classList.contains('block-content')) return 0;
      const blocks = Array.from(document.querySelectorAll('.block'));
      return heights[blocks.indexOf(this.closest('.block')!)] ?? 100;
    },
  });
});
afterEach(() => {
  delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
});

const addHeading = async (text: string, height = 100) => {
  heights.push(height);
  await userEvent.click(screen.getByRole('button', { name: 'Heading' }));
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>('.block .heading'),
  ).pop()!;
  // jsdom does not treat contenteditable="plaintext-only" as editable, so type by hand.
  heading.textContent = text;
  fireEvent.input(heading);
};
const setLevel = (level: number) =>
  userEvent.click(screen.getByRole('button', { name: String(level) }));
const setTitle = (title: string) =>
  userEvent.type(screen.getByLabelText('Title'), title);

describe('Export as PDF', () => {
  it('starts from the File menu and from Ctrl+E', async () => {
    const { exportFake, menu, key } = renderApp();
    await menu('file-export-pdf');
    await key('e');
    expect(exportFake.dialogs.map((d) => d.format)).toEqual(['PDF', 'PDF']);
  });

  it('suggests the Worksheet File name, else the Title, else Worksheet.pdf', async () => {
    const { fake, exportFake, menu } = renderApp();
    await menu('file-export-pdf');
    await setTitle('Ancient Rome');
    await menu('file-export-pdf');
    fake.answerSave('rome-lesson.tpsheet');
    await menu('file-save');
    await menu('file-export-pdf');
    expect(exportFake.dialogs.map((d) => d.suggestedName)).toEqual([
      'Worksheet.pdf',
      'Ancient Rome.pdf',
      'rome-lesson.pdf',
    ]);
  });

  it('writes nothing when the dialog is cancelled', async () => {
    const { exportFake, menu } = renderApp();
    exportFake.answerDialog(null);
    await menu('file-export-pdf');
    expect(exportFake.dialogs).toHaveLength(1);
    expect(exportFake.printed).toEqual([]);
  });

  it('prints the export document to the chosen target', async () => {
    const { exportFake, menu } = renderApp();
    await addHeading('Rome');
    exportFake.answerDialog('rome.pdf');
    await menu('file-export-pdf');
    await waitFor(() => expect(exportFake.printed).toHaveLength(1));
    expect(exportFake.printed[0].target).toBe('rome.pdf');
  });

  describe('export document', () => {
    const exportDocument = async (
      app: ReturnType<typeof renderApp>,
    ): Promise<Document> => {
      app.exportFake.answerDialog('out.pdf');
      await app.menu('file-export-pdf');
      await waitFor(() => expect(app.exportFake.printed).toHaveLength(1));
      return app.exportFake.lastDocument();
    };
    const pagesOf = (doc: Document) =>
      Array.from(doc.querySelectorAll<HTMLElement>('.export-page'));

    it('is one blank Page for an empty Worksheet', async () => {
      const doc = await exportDocument(renderApp());
      expect(pagesOf(doc)).toHaveLength(1);
      expect(pagesOf(doc)[0].textContent).toBe('');
    });

    it('puts each Heading on the editor Page at the editor offset', async () => {
      const app = renderApp();
      await addHeading('One', 600);
      await setLevel(2);
      await addHeading('Two', 600);
      await setLevel(3);
      const editor = Array.from(
        document.querySelectorAll<HTMLElement>('.block'),
      ).map((block) => ({
        page: block.dataset.page,
        top: parseFloat(block.style.top),
      }));
      expect(editor.map((b) => b.page)).toEqual(['0', '1']);

      const doc = await exportDocument(app);

      const pages = pagesOf(doc);
      expect(pages).toHaveLength(2);
      const headings = pages.map((page) =>
        page.querySelector<HTMLElement>('.export-block'),
      );
      expect(headings.map((h) => h?.textContent)).toEqual(['One', 'Two']);
      expect(
        headings.map((h) => h?.querySelector('.heading')?.className),
      ).toEqual(['heading heading-level-2', 'heading heading-level-3']);
      // Page 1 starts below the first Page and its gap; the offset is relative to its own Page.
      expect(headings[0]?.style.top).toBe('72px');
      expect(headings[1]?.style.top).toBe('72px');
      expect(headings.map((h) => h?.style.height)).toEqual(['600px', '600px']);
    });

    it('exports empty Headings without placeholder text', async () => {
      const app = renderApp();
      await userEvent.click(screen.getByRole('button', { name: 'Heading' }));
      const doc = await exportDocument(app);
      expect(doc.querySelector('.heading')?.textContent).toBe('');
      expect(doc.querySelector('[data-placeholder]')).toBeNull();
    });

    it('puts Body Text on the editor Page and offset with paragraphs, marks and line breaks', async () => {
      const app = renderApp();
      heights.push(300);
      await userEvent.click(screen.getByRole('button', { name: 'Body Text' }));
      const editor = await screen.findByRole('textbox', { name: 'Body Text' });
      await waitFor(() => expect(editor).toHaveFocus());
      await userEvent.keyboard(
        '{Control>}b{/Control}Bold{Control>}b{/Control} plain{Shift>}{Enter}{/Shift}next{Enter}{Control>}i{/Control}Second',
      );
      const block = document.querySelector<HTMLElement>('.block')!;
      expect(block.dataset.page).toBe('0');
      const top = parseFloat(block.style.top);

      const doc = await exportDocument(app);

      const exported =
        pagesOf(doc)[0].querySelector<HTMLElement>('.export-block')!;
      expect(parseFloat(exported.style.top)).toBe(top);
      expect(exported.style.height).toBe('300px');
      const paragraphs = Array.from(exported.querySelectorAll('p'));
      expect(paragraphs.map((p) => p.innerHTML)).toEqual([
        '<strong>Bold</strong> plain<br>next',
        '<em>Second</em>',
      ]);
      expect(exported.querySelector('[contenteditable]')).toBeNull();
    });

    it('exports empty Body Text as empty space without placeholder', async () => {
      const app = renderApp();
      await userEvent.click(screen.getByRole('button', { name: 'Body Text' }));
      const doc = await exportDocument(app);
      const exported = doc.querySelector('.export-block')!;
      expect(exported.querySelector('.body-text')).not.toBeNull();
      expect(exported.textContent).toBe('');
      expect(exported.innerHTML).not.toContain('data-placeholder');
      expect(exported.innerHTML).not.toContain('Enter text');
    });

    it('contains no editor chrome or hints', async () => {
      const app = renderApp();
      await addHeading('Rome');
      const doc = await exportDocument(app);
      expect(
        doc.querySelector(
          '.block, .block-handle, .block-selected, .block-warning, .insertion-line, .page-hint, [role=separator], [contenteditable], button',
        ),
      ).toBeNull();
      expect(doc.body.textContent).not.toContain('Drag a Block');
    });

    it('inlines the fonts and takes the title from the Title', async () => {
      const app = renderApp();
      await setTitle('Rome & Greece');
      const doc = await exportDocument(app);
      expect(doc.title).toBe('Rome & Greece');
      const css = doc.querySelector('style')!.textContent!;
      expect(css.match(/@font-face/g)).toHaveLength(4);
      expect(css).toContain('data:font/woff2;base64,');
      expect(css).not.toMatch(/url\((?!data:)/);
      expect(css).toMatch(/@page\s*{[^}]*A4/);
    });

    it('leaves the Worksheet and Unsaved Changes untouched', async () => {
      const app = renderApp();
      await addHeading('Rome');
      app.fake.answerSave('rome.tpsheet');
      await app.menu('file-save');
      const titlesBefore = [...app.fake.titles];
      await exportDocument(app);
      expect(app.fake.titles).toEqual(titlesBefore);
      expect(titlesBefore[titlesBefore.length - 1]).not.toMatch(/^•/);
      expect(
        Array.from(document.querySelectorAll('.heading'), (h) => h.textContent),
      ).toEqual(['Rome']);
    });
  });

  it('reports a failing printToPdf as an error and keeps the Worksheet', async () => {
    const { fake, exportFake, menu } = renderApp();
    await addHeading('Rome');
    exportFake.answerDialog('rome.pdf');
    exportFake.failNextPrint('disk full');
    await menu('file-export-pdf');
    await waitFor(() => expect(fake.errors).toHaveLength(1));
    expect(fake.errors[0]).toContain('Could not export');
    expect(fake.errors[0]).toContain('disk full');
    expect(document.querySelector('.heading')?.textContent).toBe('Rome');
  });
});
