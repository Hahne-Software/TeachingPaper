export type Block = {
  id: string;
  type: string;
  data: unknown;
};

export type WorksheetState = {
  blocks: Block[];
  selectedId: string | null;
  nextId: number;
};

export type WorksheetAction =
  | { type: 'insert'; blockType: string; index?: number }
  | { type: 'update'; id: string; data: unknown };

export const initialState: WorksheetState = {
  blocks: [],
  selectedId: null,
  nextId: 1,
};

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
        const index = Math.min(
          Math.max(action.index ?? state.blocks.length, 0),
          state.blocks.length,
        );
        return {
          blocks: [
            ...state.blocks.slice(0, index),
            block,
            ...state.blocks.slice(index),
          ],
          selectedId: block.id,
          nextId: state.nextId + 1,
        };
      }
      case 'update':
        return {
          ...state,
          blocks: state.blocks.map((block) =>
            block.id === action.id ? { ...block, data: action.data } : block,
          ),
        };
    }
  };
