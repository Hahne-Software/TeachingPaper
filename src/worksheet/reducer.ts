import { blockTypes } from '../blocks/registry';

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

export function worksheetReducer(
  state: WorksheetState,
  action: WorksheetAction,
): WorksheetState {
  switch (action.type) {
    case 'insert': {
      const definition = blockTypes[action.blockType];
      if (!definition) return state;
      const block: Block = {
        id: `block-${state.nextId}`,
        type: action.blockType,
        data: definition.defaultData(),
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
}
