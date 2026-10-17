// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DOMParser } from '@tiptap/pm/model';
import { Editor } from '@tiptap/core';
import { bodyTextBlockType, bodyTextExtensions } from './body-text';
import {
  fromTiptapDoc,
  toTiptapDoc,
  type BodyTextData,
} from './body-text-format';

const { View, PropertiesView, defaultData } = bodyTextBlockType;

function setup(autoFocus = true) {
  const onChange = vi.fn();
  render(
    <>
      <View
        data={defaultData() as never}
        autoFocus={autoFocus}
        onChange={onChange}
      />
      <PropertiesView data={defaultData() as never} onChange={() => {}} />
    </>,
  );
  return { onChange, editor: screen.getByRole('textbox') };
}

const lastData = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];

describe('Body Text', () => {
  it('starts empty with a placeholder and focus', async () => {
    const { editor } = setup();
    expect(await screen.findByRole('textbox')).toHaveFocus();
    expect(editor.querySelector('p')).toHaveAttribute(
      'data-placeholder',
      'Enter text…',
    );
  });

  it.each([
    ['b', 'Bold'],
    ['i', 'Italic'],
    ['u', 'Underline'],
  ] as const)(
    'toggles %s via keyboard shortcut and reflects it in the buttons',
    async (key, label) => {
      const { editor } = setup();
      await waitFor(() => expect(editor).toHaveFocus());
      const button = screen.getByRole('button', { name: label });
      expect(button).toHaveAttribute('aria-pressed', 'false');

      await userEvent.keyboard(`{Control>}${key}{/Control}`);

      await waitFor(() =>
        expect(button).toHaveAttribute('aria-pressed', 'true'),
      );
    },
  );

  it.each([
    ['Bold', 'bold'],
    ['Italic', 'italic'],
    ['Underline', 'underline'],
  ] as const)(
    'applies %s to the selected text and stores only our own format',
    async (label, mark) => {
      const onChange = vi.fn();
      render(
        <>
          <View
            data={{
              paragraphs: [
                [{ text: 'hi', bold: false, italic: false, underline: false }],
              ],
            }}
            autoFocus={false}
            onChange={onChange}
          />
          <PropertiesView data={defaultData() as never} onChange={() => {}} />
        </>,
      );
      await userEvent.click(screen.getByRole('textbox'));
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.click(screen.getByRole('button', { name: label }));

      await waitFor(() => expect(onChange).toHaveBeenCalled());
      expect(lastData(onChange)).toEqual({
        paragraphs: [
          [
            {
              text: 'hi',
              bold: false,
              italic: false,
              underline: false,
              [mark]: true,
            },
          ],
        ],
      });
    },
  );

  it('points the buttons at the Block that was clicked', async () => {
    render(
      <>
        <View
          data={defaultData() as never}
          autoFocus={false}
          onChange={() => {}}
        />
        <View
          data={defaultData() as never}
          autoFocus={false}
          onChange={() => {}}
        />
        <PropertiesView data={defaultData() as never} onChange={() => {}} />
      </>,
    );
    const [first, second] = screen.getAllByRole('textbox');
    await userEvent.click(first);
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(second);

    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('Body Text editor schema', () => {
  const create = () =>
    new Editor({
      extensions: bodyTextExtensions,
      content: toTiptapDoc(defaultData() as BodyTextData),
    });

  it('starts a new paragraph within the same Block on Enter', () => {
    const editor = create();
    editor.commands.insertContent('One');
    editor.commands.splitBlock();
    editor.commands.insertContent('Two');

    expect(fromTiptapDoc(editor.getJSON()).paragraphs).toEqual([
      [{ text: 'One', bold: false, italic: false, underline: false }],
      [{ text: 'Two', bold: false, italic: false, underline: false }],
    ]);
  });

  it('formats only the selected range', () => {
    const editor = new Editor({
      extensions: bodyTextExtensions,
      content: toTiptapDoc({
        paragraphs: [
          [{ text: 'abcdef', bold: false, italic: false, underline: false }],
        ],
      }),
    });
    editor
      .chain()
      .setTextSelection({ from: 3, to: 5 })
      .toggleMark('italic')
      .run();

    expect(fromTiptapDoc(editor.getJSON()).paragraphs[0]).toEqual([
      { text: 'ab', bold: false, italic: false, underline: false },
      { text: 'cd', bold: false, italic: true, underline: false },
      { text: 'ef', bold: false, italic: false, underline: false },
    ]);
  });

  it('drops lists, links, colours and alignment on paste', () => {
    const editor = create();
    // Pasted HTML is parsed against the schema, exactly as ProseMirror does.
    const html = document.createElement('div');
    html.innerHTML =
      '<ul><li>item</li></ul><p style="color:red;text-align:center"><a href="x">link</a> <b>bold</b></p>';
    const pasted = DOMParser.fromSchema(editor.schema).parse(html);
    editor.commands.setContent(pasted.toJSON());

    expect(editor.getHTML()).not.toMatch(/<(ul|li|a|span)\b|style=|href=/);
    expect(fromTiptapDoc(editor.getJSON()).paragraphs.flat()).toContainEqual({
      text: 'bold',
      bold: true,
      italic: false,
      underline: false,
    });
  });
});
