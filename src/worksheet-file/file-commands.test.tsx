// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render-app';
import { emptyMetadata } from '../worksheet/metadata';
import { encodeWorksheet } from './codec';

const addHeading = async (text: string) => {
  await userEvent.click(screen.getByRole('button', { name: 'Heading' }));
  // jsdom does not treat contenteditable="plaintext-only" as editable, so type by hand.
  const heading = document.querySelector<HTMLElement>('.heading')!;
  heading.textContent = text;
  fireEvent.input(heading);
};
const headings = () =>
  Array.from(document.querySelectorAll('.heading'), (h) => h.textContent);
const lastTitle = (fake: { titles: string[] }) =>
  fake.titles[fake.titles.length - 1];

describe('Worksheet File commands', () => {
  it('asks for a location on the first Save, then rewrites the same file silently', async () => {
    const { fake, menu } = renderApp();
    await addHeading('Rome');
    fake.answerSave('rome.tpsheet');

    await menu('file-save');
    await menu('file-save');

    expect(fake.saveDialogs).toBe(1);
    expect(fake.writes).toEqual(['rome.tpsheet', 'rome.tpsheet']);
  });

  it('saves a Worksheet that opens again unchanged', async () => {
    const { fake, menu } = renderApp();
    await addHeading('Rome');
    fake.answerSave('rome.tpsheet');
    await menu('file-save');
    await userEvent.click(
      document.querySelector<HTMLElement>('[aria-label="Delete Block"]')!,
    );
    expect(headings()).toEqual([]);

    fake.answerQuestion('discard');
    fake.answerOpen('rome.tpsheet');
    await menu('open-file');

    await waitFor(() => expect(headings()).toEqual(['Rome']));
  });

  it('Save As always asks and switches to the new file', async () => {
    const { fake, menu } = renderApp();
    await addHeading('Rome');
    fake.answerSave('a.tpsheet');
    await menu('file-save');
    fake.answerSave('b.tpsheet');
    await menu('file-save-as');
    await menu('file-save');

    expect(fake.saveDialogs).toBe(2);
    expect(fake.writes).toEqual(['a.tpsheet', 'b.tpsheet', 'b.tpsheet']);
    expect(lastTitle(fake)).toBe('b.tpsheet — TeachingPaper');
  });

  it('changes nothing when a dialog is cancelled', async () => {
    const { fake, menu } = renderApp();
    await addHeading('Rome');

    fake.answerSave(null);
    await menu('file-save');
    fake.answerOpen(null);
    await menu('open-file');

    expect(fake.writes).toEqual([]);
    expect(headings()).toEqual(['Rome']);
    expect(lastTitle(fake)).toBe('• Untitled — TeachingPaper');
  });

  it('works through Ctrl+S, Ctrl+Shift+S and Ctrl+O', async () => {
    const { fake, key } = renderApp();
    fake.files.set(
      'x.tpsheet',
      encodeWorksheet({
        metadata: emptyMetadata,
        blocks: [{ type: 'heading', data: { text: 'X', level: 1 } }],
      }),
    );

    fake.answerOpen('x.tpsheet');
    await key('o');
    await waitFor(() => expect(headings()).toEqual(['X']));
    await key('s');
    fake.answerSave('y.tpsheet');
    await key('s', '{Shift>}');

    await waitFor(() =>
      expect(fake.writes).toEqual(['x.tpsheet', 'y.tpsheet']),
    );
    expect(fake.openDialogs).toBe(1);
  });

  it('shows the current file name in the window title', async () => {
    const { fake, menu } = renderApp();
    expect(lastTitle(fake)).toBe('Untitled — TeachingPaper');
    fake.files.set(
      'x.tpsheet',
      encodeWorksheet({ metadata: emptyMetadata, blocks: [] }),
    );

    fake.answerOpen('x.tpsheet');
    await menu('open-file');

    await waitFor(() =>
      expect(lastTitle(fake)).toBe('x.tpsheet — TeachingPaper'),
    );
  });

  it('marks Unsaved Changes in the window title until the Worksheet is saved', async () => {
    const { fake, menu } = renderApp();
    await addHeading('Rome');
    expect(lastTitle(fake)).toBe('• Untitled — TeachingPaper');

    fake.answerSave('rome.tpsheet');
    await menu('file-save');
    expect(lastTitle(fake)).toBe('rome.tpsheet — TeachingPaper');

    await addHeading('Carthage');
    expect(lastTitle(fake)).toBe('• rome.tpsheet — TeachingPaper');
  });

  it('counts editing the Worksheet Metadata as a change', async () => {
    const { fake } = renderApp();
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), 'H');
    expect(lastTitle(fake)).toBe('• Untitled — TeachingPaper');
  });

  it('does not count selecting a Block as a change', async () => {
    const { fake, menu } = renderApp();
    await addHeading('Rome');
    fake.answerSave('rome.tpsheet');
    await menu('file-save');

    await userEvent.click(document.querySelector<HTMLElement>('.heading')!);
    await userEvent.click(document.querySelector<HTMLElement>('.page')!);

    expect(lastTitle(fake)).toBe('rome.tpsheet — TeachingPaper');
  });

  it('New starts an empty Untitled Worksheet without asking when there are no Unsaved Changes', async () => {
    const { fake, menu } = renderApp();
    await addHeading('Rome');
    fake.answerSave('rome.tpsheet');
    await menu('file-save');

    await menu('file-new');

    expect(headings()).toEqual([]);
    expect(lastTitle(fake)).toBe('Untitled — TeachingPaper');
    expect(fake.questions).toEqual([]);
  });

  describe('with Unsaved Changes', () => {
    const romeFile = () =>
      encodeWorksheet({
        metadata: emptyMetadata,
        blocks: [{ type: 'heading', data: { text: 'Rome', level: 1 } }],
      });

    it("New asks about them and, on Don't Save, starts an empty Worksheet", async () => {
      const { fake, key } = renderApp();
      await addHeading('Rome');
      fake.answerQuestion('discard');

      await key('n');

      await waitFor(() => expect(headings()).toEqual([]));
      expect(fake.questions).toEqual(['Untitled']);
      expect(fake.writes).toEqual([]);
      expect(lastTitle(fake)).toBe('Untitled — TeachingPaper');
    });

    it('New on Save saves them first', async () => {
      const { fake, menu } = renderApp();
      await addHeading('Rome');
      fake.answerQuestion('save');
      fake.answerSave('rome.tpsheet');

      await menu('file-new');

      expect(fake.writes).toEqual(['rome.tpsheet']);
      expect(headings()).toEqual([]);
      expect(lastTitle(fake)).toBe('Untitled — TeachingPaper');
    });

    it('New on Cancel keeps everything', async () => {
      const { fake, menu } = renderApp();
      await addHeading('Rome');
      fake.answerQuestion('cancel');

      await menu('file-new');

      expect(headings()).toEqual(['Rome']);
      expect(lastTitle(fake)).toBe('• Untitled — TeachingPaper');
    });

    it('New on Save keeps everything when the save dialog is cancelled', async () => {
      const { fake, menu } = renderApp();
      await addHeading('Rome');
      fake.answerQuestion('save');
      fake.answerSave(null);

      await menu('file-new');

      expect(fake.saveDialogs).toBe(1);
      expect(fake.writes).toEqual([]);
      expect(headings()).toEqual(['Rome']);
      expect(lastTitle(fake)).toBe('• Untitled — TeachingPaper');
    });

    it('Open asks about them, names the current file and on Save rewrites it first', async () => {
      const { fake, menu } = renderApp();
      fake.files.set('x.tpsheet', romeFile());
      await addHeading('Carthage');
      fake.answerSave('carthage.tpsheet');
      await menu('file-save');
      await addHeading('Utica');
      fake.answerQuestion('save');
      fake.answerOpen('x.tpsheet');

      await menu('open-file');

      await waitFor(() => expect(headings()).toEqual(['Rome']));
      expect(fake.questions).toEqual(['carthage.tpsheet']);
      expect(fake.writes).toEqual(['carthage.tpsheet', 'carthage.tpsheet']);
      expect(fake.saveDialogs).toBe(1);
    });

    it('Open on Cancel does not even show the open dialog', async () => {
      const { fake, menu } = renderApp();
      await addHeading('Rome');
      fake.answerQuestion('cancel');

      await menu('open-file');

      expect(fake.openDialogs).toBe(0);
      expect(headings()).toEqual(['Rome']);
    });

    it.each([
      ['save', 'rome.tpsheet', true, ['rome.tpsheet']],
      ['discard', null, true, []],
      ['cancel', null, false, []],
      ['save', null, false, []],
    ] as const)(
      'closing the window on %s (save dialog: %s) closes: %s',
      async (answer, saveAs, closes, writes) => {
        const { fake } = renderApp();
        await addHeading('Rome');
        fake.answerQuestion(answer);
        fake.answerSave(saveAs);

        expect(await act(fake.requestClose)).toBe(closes);
        expect(fake.questions).toEqual(['Untitled']);
        expect(fake.writes).toEqual(writes);
      },
    );
  });

  it('closes the window without asking when there are no Unsaved Changes', async () => {
    const { fake } = renderApp();
    expect(await act(fake.requestClose)).toBe(true);
    expect(fake.questions).toEqual([]);
  });
});
