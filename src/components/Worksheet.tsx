import { blockTypes } from '../blocks/registry';
import type { BlockTypeDefinition } from '../blocks/types';
import { useWorksheet } from '../worksheet/context';
import type { Block } from '../worksheet/reducer';

export function Worksheet() {
  const { state } = useWorksheet();

  return (
    <main className="document-area">
      <div className="page">
        {state.blocks.length === 0 && (
          <p className="page-hint">Drag a Block here from the left</p>
        )}
        {state.blocks.map((block) => {
          const definition = blockTypes[block.type];
          if (!definition) return null;
          return (
            <BlockHost
              key={block.id}
              block={block}
              definition={definition}
              autoFocus={block.id === state.selectedId}
            />
          );
        })}
      </div>
    </main>
  );
}

function BlockHost({
  block,
  definition,
  autoFocus,
}: {
  block: Block;
  definition: BlockTypeDefinition;
  autoFocus: boolean;
}) {
  const { dispatch } = useWorksheet();
  const { View } = definition;
  return (
    <div className="block">
      <View
        data={block.data}
        autoFocus={autoFocus}
        onChange={(data) => dispatch({ type: 'update', id: block.id, data })}
      />
    </div>
  );
}
