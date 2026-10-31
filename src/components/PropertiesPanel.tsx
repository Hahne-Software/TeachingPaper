import type { ClipboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { definitionFor } from '../blocks/registry';
import { useWorksheet } from '../worksheet/context';
import { metadataFields, type WorksheetMetadata } from '../worksheet/metadata';
import { singleLine } from '../worksheet/single-line';

/** `value` with `pasted` put in place of the selection, as one line; and the caret after it. */
const pasteAsSingleLine = (
  value: string,
  selection: { start: number; end: number },
  pasted: string,
) => {
  const text = singleLine(pasted);
  return {
    value: value.slice(0, selection.start) + text + value.slice(selection.end),
    caret: selection.start + text.length,
  };
};

function MetadataProperties() {
  const { state, dispatch } = useWorksheet();
  const update = (field: keyof WorksheetMetadata, value: string) =>
    dispatch({ type: 'updateMetadata', metadata: { [field]: value } });

  // Inputs drop pasted line breaks silently, gluing the lines together; paste them as spaces.
  const paste = (
    field: keyof WorksheetMetadata,
    event: ClipboardEvent<HTMLInputElement>,
  ) => {
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const { value, caret } = pasteAsSingleLine(
      input.value,
      { start, end: input.selectionEnd ?? start },
      event.clipboardData.getData('text/plain'),
    );
    flushSync(() => update(field, value));
    input.setSelectionRange(caret, caret);
  };

  return (
    <>
      <p className="muted">Worksheet</p>
      {metadataFields.map(({ field, label }) => (
        <label key={field} className="field">
          {label}
          <input
            type="text"
            value={state.metadata[field]}
            onChange={(event) => update(field, event.target.value)}
            onPaste={(event) => paste(field, event)}
          />
        </label>
      ))}
    </>
  );
}

export function PropertiesPanel() {
  const { state, dispatch } = useWorksheet();
  const selected = state.blocks.find((block) => block.id === state.selectedId);
  const definition = selected && definitionFor(selected.type);

  return (
    <aside className="sidebar properties-panel" aria-label="Properties Panel">
      <h2>Properties</h2>
      {selected && definition ? (
        <>
          <p className="muted">{definition.label}</p>
          <definition.PropertiesView
            data={selected.data}
            onChange={(data) =>
              dispatch({ type: 'update', id: selected.id, data })
            }
          />
        </>
      ) : (
        <MetadataProperties />
      )}
    </aside>
  );
}
