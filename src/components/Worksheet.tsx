import { blockTypes } from '../blocks/registry';
import { useWorksheet } from '../worksheet/context';

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
            <BlockView
              key={block.id}
              id={block.id}
              type={block.type}
              data={block.data}
              autoFocus={block.id === state.selectedId}
            />
          );
        })}
      </div>
    </main>
  );
}

function BlockView(props: {
  id: string;
  type: string;
  data: unknown;
  autoFocus: boolean;
}) {
  const { dispatch } = useWorksheet();
  const { View } = blockTypes[props.type];
  return (
    <div className="block">
      <View
        data={props.data}
        autoFocus={props.autoFocus}
        onChange={(data) =>
          dispatch({ type: 'update', id: props.id, data })
        }
      />
    </div>
  );
}
