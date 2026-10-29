import { describe, expect, it } from 'vitest';
import {
  createWorksheetReducer,
  initialState,
  type WorksheetState,
} from './reducer';
import { emptyMetadata } from './metadata';

const worksheetReducer = createWorksheetReducer({
  heading: () => ({ text: '', level: 1 }),
});

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

describe('worksheetReducer selection', () => {
  const twoBlocks = () => {
    let state = initialState;
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    return state;
  };

  it('selects a Block by id', () => {
    const state = twoBlocks();
    const firstId = state.blocks[0].id;

    expect(
      worksheetReducer(state, { type: 'select', id: firstId }).selectedId,
    ).toBe(firstId);
  });

  it('leaves the state unchanged when selecting an unknown id', () => {
    const state = twoBlocks();

    expect(worksheetReducer(state, { type: 'select', id: 'nope' })).toBe(state);
  });

  it('deselects', () => {
    const state = worksheetReducer(twoBlocks(), { type: 'deselect' });

    expect(state.selectedId).toBeNull();
  });

  it('inserts after the selected Block', () => {
    let state = twoBlocks();
    const [first, second] = state.blocks;
    state = worksheetReducer(state, { type: 'select', id: first.id });

    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });

    expect(state.blocks.map((b) => b.id)).toEqual([
      first.id,
      state.selectedId,
      second.id,
    ]);
  });

  it('inserts at the end when nothing is selected', () => {
    let state = worksheetReducer(twoBlocks(), { type: 'deselect' });
    const ids = state.blocks.map((b) => b.id);

    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });

    expect(state.blocks.map((b) => b.id)).toEqual([...ids, state.selectedId]);
  });
});

describe('worksheetReducer remove', () => {
  const twoBlocks = () => {
    let state = initialState;
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    return state;
  };

  it('removes the Block', () => {
    const state = twoBlocks();
    const [first, second] = state.blocks;

    const next = worksheetReducer(state, { type: 'remove', id: first.id });

    expect(next.blocks.map((b) => b.id)).toEqual([second.id]);
  });

  it('clears the selection when removing the selected Block', () => {
    const state = twoBlocks();

    const next = worksheetReducer(state, {
      type: 'remove',
      id: state.selectedId!,
    });

    expect(next.selectedId).toBeNull();
  });

  it('keeps the selection when removing another Block', () => {
    const state = twoBlocks();

    const next = worksheetReducer(state, {
      type: 'remove',
      id: state.blocks[0].id,
    });

    expect(next.selectedId).toBe(state.selectedId);
  });

  it('leaves the state unchanged for an unknown id', () => {
    const state = twoBlocks();

    expect(worksheetReducer(state, { type: 'remove', id: 'nope' })).toBe(state);
  });
});

describe('worksheetReducer move', () => {
  const threeBlocks = () =>
    Array.from({ length: 3 }).reduce<WorksheetState>(
      (state) =>
        worksheetReducer(state, { type: 'insert', blockType: 'heading' }),
      initialState,
    );
  const ids = (state: WorksheetState) => state.blocks.map((b) => b.id);

  it('moves a Block to the first position', () => {
    const state = threeBlocks();
    const [a, b, c] = ids(state);
    const next = worksheetReducer(state, { type: 'move', id: c, index: 0 });
    expect(ids(next)).toEqual([c, a, b]);
  });

  it('moves a Block to a middle position', () => {
    const state = threeBlocks();
    const [a, b, c] = ids(state);
    const next = worksheetReducer(state, { type: 'move', id: a, index: 2 });
    expect(ids(next)).toEqual([b, a, c]);
  });

  it('moves a Block to the last position', () => {
    const state = threeBlocks();
    const [a, b, c] = ids(state);
    const next = worksheetReducer(state, { type: 'move', id: a, index: 3 });
    expect(ids(next)).toEqual([b, c, a]);
  });

  it('leaves the order unchanged when moved to its own position', () => {
    const state = threeBlocks();
    const [, b] = ids(state);
    for (const index of [1, 2]) {
      const next = worksheetReducer(state, { type: 'move', id: b, index });
      expect(ids(next)).toEqual(ids(state));
    }
  });

  it('leaves the state unchanged for an unknown id', () => {
    const state = threeBlocks();
    expect(
      worksheetReducer(state, { type: 'move', id: 'nope', index: 0 }),
    ).toBe(state);
  });

  it('keeps the moved Block selected', () => {
    const state = worksheetReducer(threeBlocks(), {
      type: 'select',
      id: 'block-1',
    });
    const next = worksheetReducer(state, {
      type: 'move',
      id: 'block-1',
      index: 3,
    });
    expect(next.selectedId).toBe('block-1');
  });

  it('keeps another selection when a different Block is moved', () => {
    const state = worksheetReducer(threeBlocks(), {
      type: 'select',
      id: 'block-2',
    });
    const next = worksheetReducer(state, {
      type: 'move',
      id: 'block-1',
      index: 3,
    });
    expect(next.selectedId).toBe('block-2');
  });
});

describe('worksheetReducer replace', () => {
  it('replaces all Blocks with freshly identified ones and clears the selection', () => {
    let state = worksheetReducer(initialState, {
      type: 'insert',
      blockType: 'heading',
    });
    const oldId = state.blocks[0].id;

    state = worksheetReducer(state, {
      type: 'replace',
      metadata: emptyMetadata,
      blocks: [
        { type: 'heading', data: { text: 'A', level: 2 } },
        { type: 'heading', data: { text: 'B', level: 3 } },
      ],
    });

    expect(state.blocks.map(({ type, data }) => ({ type, data }))).toEqual([
      { type: 'heading', data: { text: 'A', level: 2 } },
      { type: 'heading', data: { text: 'B', level: 3 } },
    ]);
    expect(new Set(state.blocks.map((b) => b.id)).size).toBe(2);
    expect(state.blocks.map((b) => b.id)).not.toContain(oldId);
    expect(state.selectedId).toBeNull();
  });
});

describe('worksheetReducer Worksheet Metadata', () => {
  it('starts with empty Metadata', () => {
    expect(initialState.metadata).toEqual(emptyMetadata);
  });

  it('updates single Metadata fields and keeps them through Block changes', () => {
    let state = worksheetReducer(initialState, {
      type: 'updateMetadata',
      metadata: { title: 'Rome' },
    });
    state = worksheetReducer(state, {
      type: 'updateMetadata',
      metadata: { subject: 'History' },
    });
    state = worksheetReducer(state, { type: 'insert', blockType: 'heading' });
    state = worksheetReducer(state, { type: 'deselect' });

    expect(state.metadata).toEqual({
      ...emptyMetadata,
      title: 'Rome',
      subject: 'History',
    });
  });

  it('takes the Metadata of a replacing Worksheet', () => {
    const before = worksheetReducer(initialState, {
      type: 'updateMetadata',
      metadata: { title: 'Old', topic: 'Old topic' },
    });

    const state = worksheetReducer(before, {
      type: 'replace',
      metadata: { ...emptyMetadata, title: 'New' },
      blocks: [],
    });

    expect(state.metadata).toEqual({ ...emptyMetadata, title: 'New' });
  });
});
