import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { blockTypes } from '../blocks/registry';
import { dropIndex } from '../worksheet/drop-index';
import { useWorksheet } from '../worksheet/context';
import type { Block } from '../worksheet/reducer';

export const WORKSHEET_DROPPABLE_ID = 'worksheet';

const InsertionIndexContext = createContext<number | null>(null);

/** Index where the dragged Block Type would be inserted, or null when not over the Worksheet. */
export const useInsertionIndex = () => useContext(InsertionIndexContext);

const pointerY = (event: DragMoveEvent): number | null => {
  const origin = event.activatorEvent as Partial<PointerEvent>;
  return typeof origin.clientY === 'number'
    ? origin.clientY + event.delta.y
    : null;
};

/** Live viewport rects of the Blocks, in the order of the flat Block list. */
const blockRects = (blocks: Block[]) =>
  blocks.flatMap((block) => {
    const element = document.querySelector(`[data-block-id="${block.id}"]`);
    return element ? [element.getBoundingClientRect()] : [];
  });

const currentDropIndex = (
  event: DragMoveEvent,
  blocks: Block[],
): number | null => {
  const y = pointerY(event);
  if (y === null || event.over?.id !== WORKSHEET_DROPPABLE_ID) return null;
  return dropIndex(blockRects(blocks), y);
};

export function WorksheetDnd({ children }: { children: ReactNode }) {
  const { state, dispatch } = useWorksheet();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  // Pointer-based sensors; the distance keeps a plain click a click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const end = () => {
    setActiveType(null);
    setIndex(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) => setActiveType(String(event.active.id))}
      onDragMove={(event) => setIndex(currentDropIndex(event, state.blocks))}
      onDragOver={(event) => {
        if (event.over?.id !== WORKSHEET_DROPPABLE_ID) setIndex(null);
      }}
      onDragEnd={(event) => {
        const at = currentDropIndex(event as DragMoveEvent, state.blocks);
        if (at !== null) {
          dispatch({
            type: 'insert',
            blockType: String(event.active.id),
            index: at,
          });
        }
        end();
      }}
      onDragCancel={end}
    >
      <InsertionIndexContext.Provider value={index}>
        {children}
      </InsertionIndexContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeType && blockTypes[activeType] ? (
          <div className="palette-entry palette-drag-preview">
            <span className="palette-icon">{blockTypes[activeType].icon}</span>
            {blockTypes[activeType].label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
