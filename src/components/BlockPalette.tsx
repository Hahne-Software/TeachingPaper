import { useDraggable } from '@dnd-kit/core';
import { blockTypes } from '../blocks/registry';
import type { BlockTypeDefinition } from '../blocks/types';
import { useWorksheet } from '../worksheet/context';

export function BlockPalette() {
  const { dispatch } = useWorksheet();

  return (
    <aside className="sidebar block-palette" aria-label="Block Palette">
      <h2>Blocks</h2>
      <ul>
        {Object.entries(blockTypes).map(([id, definition]) => (
          <li key={id}>
            <PaletteEntry
              id={id}
              definition={definition}
              onInsert={() => dispatch({ type: 'insert', blockType: id })}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function PaletteEntry({
  id,
  definition,
  onInsert,
}: {
  id: string;
  definition: BlockTypeDefinition;
  onInsert: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });
  return (
    <button
      type="button"
      className="palette-entry"
      ref={setNodeRef}
      onClick={onInsert}
      {...attributes}
      {...listeners}
    >
      <span className="palette-icon">{definition.icon}</span>
      {definition.label}
    </button>
  );
}
