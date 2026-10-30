import { emptyMetadata, type WorksheetMetadata } from './metadata';

export type Block = {
  id: string;
  type: string;
  data: unknown;
};

/** The content of a Worksheet, the part a Worksheet File keeps. */
export type WorksheetContent = {
  metadata: WorksheetMetadata;
  blocks: Block[];
};

export type WorksheetState = WorksheetContent & {
  /** The content as it was last saved, opened or started; compared by reference. */
  saved: WorksheetContent;
  selectedId: string | null;
  nextId: number;
};

export type WorksheetAction =
  | { type: 'insert'; blockType: string; index?: number }
  | { type: 'update'; id: string; data: unknown }
  | { type: 'remove'; id: string }
  /** `index` is a drop position in the list as it is before the move. */
  | { type: 'move'; id: string; index: number }
  /** Replaces the whole Worksheet, e.g. after opening a Worksheet File. */
  | {
      type: 'replace';
      metadata: WorksheetMetadata;
      blocks: { type: string; data: unknown }[];
    }
  | { type: 'updateMetadata'; metadata: Partial<WorksheetMetadata> }
  /** The given content was written to a Worksheet File. */
  | { type: 'saved'; content: WorksheetContent }
  | { type: 'select'; id: string }
  | { type: 'deselect' };

const emptyContent: WorksheetContent = { metadata: emptyMetadata, blocks: [] };

export const initialState: WorksheetState = {
  ...emptyContent,
  saved: emptyContent,
  selectedId: null,
  nextId: 1,
};

/** Whether the content changed since it was last saved, opened or started; selection does not count. */
export const hasUnsavedChanges = ({
  metadata,
  blocks,
  saved,
}: WorksheetState) => metadata !== saved.metadata || blocks !== saved.blocks;

/** Default data per Block Type id; keeps the reducer free of UI imports. */
export type BlockDefaults = Record<string, () => unknown>;

export const createWorksheetReducer =
  (defaults: BlockDefaults) =>
  (state: WorksheetState, action: WorksheetAction): WorksheetState => {
    switch (action.type) {
      case 'insert': {
        const defaultData = defaults[action.blockType];
        if (!defaultData) return state;
        const block: Block = {
          id: `block-${state.nextId}`,
          type: action.blockType,
          data: defaultData(),
        };
        const selectedIndex = state.blocks.findIndex(
          (b) => b.id === state.selectedId,
        );
        const defaultIndex =
          selectedIndex === -1 ? state.blocks.length : selectedIndex + 1;
        const index = Math.min(
          Math.max(action.index ?? defaultIndex, 0),
          state.blocks.length,
        );
        return {
          ...state,
          blocks: [
            ...state.blocks.slice(0, index),
            block,
            ...state.blocks.slice(index),
          ],
          selectedId: block.id,
          nextId: state.nextId + 1,
        };
      }
      case 'remove':
        return state.blocks.some((b) => b.id === action.id)
          ? {
              ...state,
              blocks: state.blocks.filter((b) => b.id !== action.id),
              selectedId:
                state.selectedId === action.id ? null : state.selectedId,
            }
          : state;
      case 'move': {
        const from = state.blocks.findIndex((b) => b.id === action.id);
        if (from === -1) return state;
        const target = Math.min(Math.max(action.index, 0), state.blocks.length);
        const to = target > from ? target - 1 : target;
        if (to === from) return state;
        const rest = state.blocks.filter((b) => b.id !== action.id);
        return {
          ...state,
          blocks: [...rest.slice(0, to), state.blocks[from], ...rest.slice(to)],
        };
      }
      case 'replace': {
        const content = {
          metadata: action.metadata,
          blocks: action.blocks.map((block, i) => ({
            ...block,
            id: `block-${state.nextId + i}`,
          })),
        };
        return {
          ...content,
          saved: content,
          selectedId: null,
          nextId: state.nextId + action.blocks.length,
        };
      }
      case 'saved':
        return { ...state, saved: action.content };
      case 'updateMetadata':
        return {
          ...state,
          metadata: { ...state.metadata, ...action.metadata },
        };
      case 'select':
        return state.blocks.some((b) => b.id === action.id)
          ? { ...state, selectedId: action.id }
          : state;
      case 'deselect':
        return { ...state, selectedId: null };
      case 'update':
        return {
          ...state,
          blocks: state.blocks.map((block) =>
            block.id === action.id ? { ...block, data: action.data } : block,
          ),
        };
    }
  };
