import { Fragment, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { blockTypes } from '../blocks/registry';
import type { BlockTypeDefinition } from '../blocks/types';
import { useWorksheet } from '../worksheet/context';
import type { Block } from '../worksheet/reducer';
import { WORKSHEET_DROPPABLE_ID, useInsertionIndex } from './WorksheetDnd';

export function Worksheet() {
  const { state, dispatch } = useWorksheet();
  const insertionIndex = useInsertionIndex();
  const { setNodeRef } = useDroppable({ id: WORKSHEET_DROPPABLE_ID });
  const { selectedId } = state;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedId === null || isTextEntry(document.activeElement)) return;
        event.preventDefault();
        dispatch({ type: 'remove', id: selectedId });
        return;
      }
      if (event.key !== 'Escape') return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      dispatch({ type: 'deselect' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, selectedId]);

  return (
    <main
      className="document-area"
      onClick={(event) => {
        if (!(event.target as Element).closest('.block')) {
          dispatch({ type: 'deselect' });
        }
      }}
    >
      <div ref={setNodeRef} className="page">
        {state.blocks.length === 0 && (
          <p className="page-hint">Drag a Block here from the left</p>
        )}
        {state.blocks.map((block, index) => {
          const definition = blockTypes[block.type];
          if (!definition) return null;
          return (
            <Fragment key={block.id}>
              {insertionIndex === index && <InsertionLine />}
              <BlockHost
                block={block}
                definition={definition}
                autoFocus={block.id === state.selectedId}
                selected={block.id === state.selectedId}
              />
            </Fragment>
          );
        })}
        {insertionIndex !== null && insertionIndex >= state.blocks.length && (
          <InsertionLine />
        )}
      </div>
    </main>
  );
}

const isTextEntry = (element: Element | null) =>
  element?.closest('input, textarea, select, [contenteditable]') != null;

function InsertionLine() {
  return <div role="separator" className="insertion-line" />;
}

function BlockHost({
  block,
  definition,
  autoFocus,
  selected,
}: {
  block: Block;
  definition: BlockTypeDefinition;
  autoFocus: boolean;
  selected: boolean;
}) {
  const { dispatch } = useWorksheet();
  const { View } = definition;
  const select = () => dispatch({ type: 'select', id: block.id });
  return (
    <div
      className={selected ? 'block block-selected' : 'block'}
      data-block-id={block.id}
      onClick={select}
      onFocus={select}
    >
      <div className="block-handle">
        <button
          type="button"
          className="block-delete"
          aria-label="Delete Block"
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: 'remove', id: block.id });
          }}
        >
          ×
        </button>
      </div>
      <View
        data={block.data}
        autoFocus={autoFocus}
        onChange={(data) => dispatch({ type: 'update', id: block.id, data })}
      />
    </div>
  );
}
