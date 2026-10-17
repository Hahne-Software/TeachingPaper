import { Bold } from '@tiptap/extension-bold';
import { Document } from '@tiptap/extension-document';
import { Italic } from '@tiptap/extension-italic';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { useEffect, useSyncExternalStore } from 'react';
import {
  fromTiptapDoc,
  toTiptapDoc,
  type BodyTextData,
} from './body-text-format';
import { defineBlockType, type BlockViewProps } from './types';

// Only paragraphs and the three marks exist in the schema, so anything else
// (lists, links, colours, alignment) is dropped on paste.
export const bodyTextExtensions = [
  Document,
  Paragraph,
  Text,
  Bold,
  Italic,
  Underline,
  UndoRedo,
  Placeholder.configure({ placeholder: 'Enter text…' }),
];

/**
 * The Properties Panel sits outside the Block's view, so the editor that
 * currently has the text selection is shared through this tiny store.
 */
const activeEditor = (() => {
  let editor: Editor | null = null;
  let version = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    version += 1;
    listeners.forEach((listener) => listener());
  };
  return {
    set(next: Editor | null) {
      editor = next;
      notify();
    },
    clear(previous: Editor) {
      if (editor === previous) this.set(null);
    },
    get: () => editor,
    notify,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
})();

function BodyTextView({
  data,
  autoFocus,
  onChange,
}: BlockViewProps<BodyTextData>) {
  // Uncontrolled: the editor owns the content while typing; seed it once.
  const editor = useEditor({
    extensions: bodyTextExtensions,
    content: toTiptapDoc(data),
    editorProps: { attributes: { 'aria-label': 'Body Text' } },
    onUpdate: ({ editor: current }) =>
      onChange(fromTiptapDoc(current.getJSON())),
  });

  useEffect(() => {
    if (!editor) return;
    const claim = () => activeEditor.set(editor);
    if (autoFocus) editor.commands.focus('end');
    if (editor.isFocused) claim();
    editor.on('focus', claim);
    editor.on('transaction', activeEditor.notify);
    return () => {
      editor.off('focus', claim);
      editor.off('transaction', activeEditor.notify);
      activeEditor.clear(editor);
    };
    // Focus is only claimed when the editor is created, not on later renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div
      className="body-text"
      // Selecting a Block must retarget the Properties Panel at its editor.
      onClickCapture={() => activeEditor.set(editor)}
      onClick={(event) => {
        if (event.target === event.currentTarget) editor?.commands.focus('end');
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

const formats = [
  { mark: 'bold', label: 'Bold', glyph: <b>B</b> },
  { mark: 'italic', label: 'Italic', glyph: <i>I</i> },
  { mark: 'underline', label: 'Underline', glyph: <u>U</u> },
] as const;

function BodyTextProperties() {
  useSyncExternalStore(activeEditor.subscribe, activeEditor.version);
  const editor = activeEditor.get();

  return (
    <div className="field">
      <span id="body-text-format-label">Format</span>
      <div
        role="group"
        aria-labelledby="body-text-format-label"
        className="segmented"
      >
        {formats.map(({ mark, label, glyph }) => (
          <button
            key={mark}
            type="button"
            aria-label={label}
            aria-pressed={editor?.isActive(mark) ?? false}
            disabled={!editor}
            // Keep the text selection: don't let the button take focus.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().toggleMark(mark).run()}
          >
            {glyph}
          </button>
        ))}
      </div>
    </div>
  );
}

export const bodyTextBlockType = defineBlockType<BodyTextData>({
  label: 'Body Text',
  icon: <span aria-hidden="true">¶</span>,
  defaultData: () => ({ paragraphs: [[]] }),
  View: BodyTextView,
  PropertiesView: BodyTextProperties,
});
