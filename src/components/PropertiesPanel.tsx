import { blockTypes } from '../blocks/registry';
import { useWorksheet } from '../worksheet/context';

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
        <p className="muted">No Block selected</p>
      )}
    </aside>
  );
}
