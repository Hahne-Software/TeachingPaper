import { describe, expect, it } from 'vitest';
import { initialState, worksheetReducer } from './reducer';

describe('worksheetReducer insert', () => {
  it('appends a Block with its Block Type default data at the end', () => {
    const state = worksheetReducer(initialState, {
      type: 'insert',
      blockType: 'heading',
    });

    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0]).toMatchObject({
      type: 'heading',
      data: { text: '', level: 1 },
    });
  });

  it('inserts at the given index', () => {
    let state = initialState;
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    const [first, second] = state.blocks;

    state = worksheetReducer(state, {
      type: 'insert',
      blockType: 'heading',
      index: 1,
    });

    expect(state.blocks.map((b) => b.id)).toEqual([
      first.id,
      state.selectedId,
      second.id,
    ]);
  });

  it('gives every new Block a unique id', () => {
    let state = initialState;
    for (let i = 0; i < 5; i++) {
      state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    }

    expect(new Set(state.blocks.map((b) => b.id)).size).toBe(5);
  });

  it('ignores unknown Block Types', () => {
    const state = worksheetReducer(initialState, {
      type: 'insert',
      blockType: 'nope',
    });

    expect(state).toBe(initialState);
  });

  it('appends after existing Blocks when no index is given', () => {
    let state = initialState;
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    const firstId = state.blocks[0].id;

    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });

    expect(state.blocks).toHaveLength(3);
    expect(state.blocks[0].id).toBe(firstId);
    expect(state.blocks[2].id).toBe(state.selectedId);
  });

  it('selects the inserted Block', () => {
    const state = worksheetReducer(initialState, {
      type: 'insert',
      blockType: 'heading',
    });

    expect(state.selectedId).toBe(state.blocks[0].id);
  });

  it('clamps a negative index to the start', () => {
    let state = initialState;
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });

    state = worksheetReducer(state, {
      type: 'insert',
      blockType: 'heading',
      index: -1,
    });

    expect(state.blocks[0].id).toBe(state.selectedId);
  });

  it('clamps an index past the end to the end', () => {
    let state = initialState;
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });

    state = worksheetReducer(state, {
      type: 'insert',
      blockType: 'heading',
      index: 99,
    });

    expect(state.blocks[state.blocks.length - 1].id).toBe(state.selectedId);
  });
});
