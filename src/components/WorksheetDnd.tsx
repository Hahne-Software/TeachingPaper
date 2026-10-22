import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { blockTypes } from '../blocks/registry';
import { dropIndex } from '../worksheet/drop-index';
import { useWorksheet } from '../worksheet/context';
import type { Block } from '../worksheet/reducer';

export const WORKSHEET_DROPPABLE_ID = 'worksheet';

/** What the pointer is carrying: a new Block Type from the Block Palette or an existing Block. */
type Dragged =
  { kind: 'type'; blockType: string } | { kind: 'block'; id: string };

/** Draggable data that marks an existing Block (as opposed to a Block Type). */
export const blockDragData = (id: string) => ({ blockId: id });

const draggedFrom = (active: DragStartEvent['active']): Dragged => {
  const blockId = (active.data.current as { blockId?: string } | undefined)
    ?.blockId;
  return blockId === undefined
    ? { kind: 'type', blockType: String(active.id) }
    : { kind: 'block', id: blockId };
};

const InsertionIndexContext = createContext<number | null>(null);

/** Index where the dragged Block Type would be inserted, or null when not over the Worksheet. */
export const useInsertionIndex = () => useContext(InsertionIndexContext);

/** Live viewport rects of the Blocks, in the order of the flat Block list. */
const blockRects = (blocks: Block[]) =>
  blocks.flatMap((block) => {
    const element = document.querySelector(`[data-block-id="${block.id}"]`);
    return element ? [element.getBoundingClientRect()] : [];
  });

const currentDropIndex = (
  event: Pick<DragMoveEvent, 'over'>,
  pointerY: number | null,
  blocks: Block[],
): number | null => {
  if (pointerY === null || event.over?.id !== WORKSHEET_DROPPABLE_ID) {
    return null;
  }
  return dropIndex(blockRects(blocks), pointerY);
};

export function WorksheetDnd({ children }: { children: ReactNode }) {
  const { state, dispatch } = useWorksheet();
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  // dnd-kit's drag delta includes scrolling, so track the pointer's viewport position itself.
  const pointerY = useRef<number | null>(null);
  useEffect(() => {
    const track = (event: PointerEvent) => {
      pointerY.current = event.clientY;
    };
    window.addEventListener('pointermove', track, true);
    return () => window.removeEventListener('pointermove', track, true);
  }, []);
  // Pointer-based sensors; the distance keeps a plain click a click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const end = () => {
    setDragged(null);
    setIndex(null);
  };

  const previewType =
    dragged?.kind === 'type'
      ? dragged.blockType
      : dragged?.kind === 'block'
        ? state.blocks.find((b) => b.id === dragged.id)?.type
        : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) => {
        const origin = event.activatorEvent as Partial<PointerEvent>;
        pointerY.current = origin.clientY ?? null;
        setDragged(draggedFrom(event.active));
      }}
      onDragMove={(event) =>
        setIndex(currentDropIndex(event, pointerY.current, state.blocks))
      }
      onDragOver={(event) => {
        if (event.over?.id !== WORKSHEET_DROPPABLE_ID) setIndex(null);
      }}
      onDragEnd={(event) => {
        const at = currentDropIndex(event, pointerY.current, state.blocks);
        if (at !== null) {
          const item = draggedFrom(event.active);
          if (item.kind === 'block') {
            dispatch({ type: 'move', id: item.id, index: at });
            end();
            return;
          }
          const { blockType } = item;
          // The new Block focuses itself on mount. Inside the pointer release, WebKit then
          // clears the caret, so Blocks inserted there can't be typed into; wait two frames.
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              dispatch({ type: 'insert', blockType, index: at }),
            ),
          );
        }
        end();
      }}
      onDragCancel={end}
    >
      <InsertionIndexContext.Provider value={index}>
        {children}
      </InsertionIndexContext.Provider>
      <DragOverlay dropAnimation={null}>
        {previewType && blockTypes[previewType] ? (
          <div className="palette-entry palette-drag-preview">
            <span className="palette-icon">{blockTypes[previewType].icon}</span>
            {blockTypes[previewType].label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
