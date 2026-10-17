import { blockTypes } from '../blocks/registry';
import { useWorksheet } from '../worksheet/context';

export function PropertiesPanel() {
  const { state } = useWorksheet();
  const selected = state.blocks.find((block) => block.id === state.selectedId);

  return (
    <aside className="sidebar properties-panel" aria-label="Properties Panel">
      <h2>Properties</h2>
      <p className="muted">
        {selected ? blockTypes[selected.type]?.label : 'No Block selected'}
      </p>
    </aside>
  );
}
