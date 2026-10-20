import { describe, expect, it } from 'vitest';
import { insertionTop, layout, PAGE_GAP } from './layout';
import {
  BLOCK_SPACING,
  PAGE_CONTENT_HEIGHT,
  PAGE_HEIGHT,
  PAGE_MARGIN,
} from './page-format';

describe('layout', () => {
  it('stacks an empty Worksheet as one A4 Page', () => {
    const result = layout([]);
    expect(result.pageHeights).toEqual([PAGE_HEIGHT]);
    expect(result.totalHeight).toBe(PAGE_HEIGHT);
  });

  it('places Blocks below the top margin, separated by the Block spacing', () => {
    const { placements } = layout([100, 50]);
    expect(placements[0]).toEqual({ page: 0, top: PAGE_MARGIN, height: 100 });
    expect(placements[1].top).toBe(PAGE_MARGIN + 100 + BLOCK_SPACING);
  });

  it('starts a moved Block at the top margin of the next Page', () => {
    const { placements, pageHeights } = layout([PAGE_CONTENT_HEIGHT, 50]);
    expect(placements[1]).toEqual({
      page: 1,
      top: PAGE_HEIGHT + PAGE_GAP + PAGE_MARGIN,
      height: 50,
    });
    expect(pageHeights).toEqual([PAGE_HEIGHT, PAGE_HEIGHT]);
  });

  it('keeps every Page A4 even when a Block overflows it', () => {
    const { pageHeights, oversized, placements } = layout([
      PAGE_CONTENT_HEIGHT + 500,
      50,
    ]);
    expect(oversized).toEqual(new Set([0]));
    expect(pageHeights).toEqual([PAGE_HEIGHT, PAGE_HEIGHT]);
    expect(placements[1].page).toBe(1);
  });
});

describe('insertionTop', () => {
  const { placements } = layout([100, 100]);

  it('sits at the top margin on an empty Worksheet', () => {
    expect(insertionTop(0, [])).toBe(PAGE_MARGIN);
  });

  it('sits midway in the spacing between two Blocks on a Page', () => {
    expect(insertionTop(1, placements)).toBe(
      placements[1].top - BLOCK_SPACING / 2,
    );
  });

  it('sits just below the last Block when appending', () => {
    expect(insertionTop(2, placements)).toBe(
      placements[1].top + 100 + BLOCK_SPACING / 2,
    );
  });
});
