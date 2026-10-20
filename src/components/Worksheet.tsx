import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useDroppable } from '@dnd-kit/core';
import { blockTypes } from '../blocks/registry';
import type { BlockTypeDefinition } from '../blocks/types';
import { useWorksheet } from '../worksheet/context';
import {
  insertionTop,
  layout,
  PAGE_GAP,
  type Placement,
} from '../worksheet/layout';
import {
  BLOCK_BLEED,
  PAGE_CONTENT_HEIGHT,
  PAGE_CONTENT_WIDTH,
  PAGE_MARGIN,
  PAGE_WIDTH,
} from '../worksheet/page-format';
import type { Block } from '../worksheet/reducer';
import { WORKSHEET_DROPPABLE_ID, useInsertionIndex } from './WorksheetDnd';

/** Fallback until a Block has been measured. */
const UNMEASURED_HEIGHT = 0;

/** Tracks each Block's rendered height, updating whenever the Block resizes. */
const useBlockHeights = () => {
  const [heights, setHeights] = useState<Record<string, number>>({});
  const report = useCallback((id: string, height: number) => {
    setHeights((current) =>
      current[id] === height ? current : { ...current, [id]: height },
    );
  }, []);
  return { heights, report };
};

export function Worksheet() {
  const { state, dispatch } = useWorksheet();
  const insertionIndex = useInsertionIndex();
  const { setNodeRef } = useDroppable({ id: WORKSHEET_DROPPABLE_ID });
  const { selectedId } = state;
  const { heights, report } = useBlockHeights();
  const { placements, pageHeights, oversized, totalHeight } = useMemo(
    () =>
      layout(
        state.blocks.map((block) => heights[block.id] ?? UNMEASURED_HEIGHT),
      ),
    [state.blocks, heights],
  );

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
      <div
        ref={setNodeRef}
        className="page-stack"
        style={{ width: PAGE_WIDTH, height: totalHeight }}
      >
        {pageHeights.map((height, page) => (
          <div
            key={page}
            className="page"
            data-page-number={page}
            style={{
              height,
              marginTop: page === 0 ? 0 : PAGE_GAP,
            }}
          >
            {page === 0 && state.blocks.length === 0 && (
              <p className="page-hint" style={{ padding: PAGE_MARGIN }}>
                Drag a Block here from the left
              </p>
            )}
          </div>
        ))}
        {state.blocks.map((block, index) => {
          const definition = blockTypes[block.type];
          if (!definition) return null;
          return (
            <Fragment key={block.id}>
              {insertionIndex === index && (
                <InsertionLine top={insertionTop(index, placements)} />
              )}
              <BlockHost
                block={block}
                definition={definition}
                autoFocus={block.id === state.selectedId}
                selected={block.id === state.selectedId}
                placement={placements[index]}
                oversized={oversized.has(index)}
                onHeight={report}
              />
            </Fragment>
          );
        })}
        {insertionIndex !== null && insertionIndex >= state.blocks.length && (
          <InsertionLine top={insertionTop(insertionIndex, placements)} />
        )}
      </div>
    </main>
  );
}

const isTextEntry = (element: Element | null) =>
  element?.closest('input, textarea, select, [contenteditable]') != null;

function InsertionLine({ top }: { top: number }) {
  return (
    <div
      role="separator"
      className="insertion-line"
      style={{
        top,
        left: PAGE_MARGIN - BLOCK_BLEED,
        width: PAGE_CONTENT_WIDTH + 2 * BLOCK_BLEED,
      }}
    />
  );
}

function BlockHost({
  block,
  definition,
  autoFocus,
  selected,
  placement,
  oversized,
  onHeight,
}: {
  block: Block;
  definition: BlockTypeDefinition;
  autoFocus: boolean;
  selected: boolean;
  placement: Placement | undefined;
  oversized: boolean;
  onHeight: (id: string, height: number) => void;
}) {
  const { dispatch } = useWorksheet();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!element) return;
    // scrollHeight is the natural height, unaffected by clipping an oversized Block.
    const measure = () => onHeight(block.id, element.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, block.id, onHeight]);
  const { View } = definition;
  const select = () => dispatch({ type: 'select', id: block.id });
  return (
    <div
      className={
        'block' +
        (selected ? ' block-selected' : '') +
        (oversized ? ' block-oversized' : '')
      }
      data-block-id={block.id}
      data-page={placement?.page}
      style={{
        top: placement?.top ?? 0,
        left: PAGE_MARGIN - BLOCK_BLEED,
        width: PAGE_CONTENT_WIDTH + 2 * BLOCK_BLEED,
      }}
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
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.6 9h6.8l.6-9M6.5 6.5v4M9.5 6.5v4" />
          </svg>
        </button>
      </div>
      <div
        ref={setElement}
        className="block-content"
        style={{ maxHeight: PAGE_CONTENT_HEIGHT }}
      >
        <View
          data={block.data}
          autoFocus={autoFocus}
          onChange={(data) => dispatch({ type: 'update', id: block.id, data })}
        />
      </div>
      {oversized && (
        <p role="alert" className="block-warning">
          Content overflows the Page and is hidden. Move the overflowing text
          into a new Block on the next Page.
        </p>
      )}
    </div>
  );
}
