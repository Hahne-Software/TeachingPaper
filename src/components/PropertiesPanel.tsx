import type { ClipboardEvent } from 'react';
import { blockTypes } from '../blocks/registry';
import { useWorksheet } from '../worksheet/context';
import type { WorksheetMetadata } from '../worksheet/metadata';

const metadataFields: [keyof WorksheetMetadata, string][] = [
  ['title', 'Title'],
  ['gradeLevel', 'Grade Level'],
  ['subject', 'Subject'],
  ['topic', 'Topic'],
];

const lineBreaksToSpaces = (text: string) =>
  text.replace(/\s*[\r\n]+\s*/g, ' ');

/**
 * Inputs drop pasted line breaks silently, gluing the lines together; paste them as spaces
 * instead. Returns the input's new value.
 */
const pasteSingleLine = (event: ClipboardEvent<HTMLInputElement>) => {
  event.preventDefault();
  const input = event.currentTarget;
  const text = lineBreaksToSpaces(event.clipboardData.getData('text/plain'));
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.setRangeText(text, start, end, 'end');
  return input.value;
};

function MetadataProperties() {
  const { state, dispatch } = useWorksheet();
  const update = (field: keyof WorksheetMetadata, value: string) =>
    dispatch({ type: 'updateMetadata', metadata: { [field]: value } });

  return (
    <>
      <p className="muted">Worksheet</p>
      {metadataFields.map(([field, label]) => (
        <label key={field} className="field">
          {label}
          <input
            type="text"
            value={state.metadata[field]}
            onChange={(event) => update(field, event.target.value)}
            onPaste={(event) => update(field, pasteSingleLine(event))}
          />
        </label>
      ))}
    </>
  );
}

export function PropertiesPanel() {
  const { state, dispatch } = useWorksheet();
  const selected = state.blocks.find((block) => block.id === state.selectedId);
  const definition = selected && blockTypes[selected.type];

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
