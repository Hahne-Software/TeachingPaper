import { blockTypes } from '../blocks/registry';
import { useWorksheet } from '../worksheet/context';

export function BlockPalette() {
  const { dispatch } = useWorksheet();

  return (
    <aside className="sidebar block-palette" aria-label="Block Palette">
      <h2>Blocks</h2>
      <ul>
        {Object.entries(blockTypes).map(([id, definition]) => (
          <li key={id}>
            <button
              type="button"
              className="palette-entry"
              onClick={() => dispatch({ type: 'insert', blockType: id })}
            >
              <span className="palette-icon">{definition.icon}</span>
              {definition.label}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
