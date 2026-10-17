// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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

  it('toggles formatting via keyboard shortcut and reflects it in the buttons', async () => {
    const { onChange } = setup();
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold).toHaveAttribute('aria-pressed', 'false');

    await userEvent.keyboard('{Control>}b{/Control}hi');

    expect(bold).toHaveAttribute('aria-pressed', 'true');
    expect(lastData(onChange).paragraphs[0]).toEqual([
      { text: 'hi', bold: true, italic: false, underline: false },
    ]);
  });

  it('applies formatting from the Properties Panel buttons', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Underline' }));
    await userEvent.keyboard('u');

    expect(lastData(onChange).paragraphs[0]).toEqual([
      { text: 'u', bold: false, italic: false, underline: true },
    ]);
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
