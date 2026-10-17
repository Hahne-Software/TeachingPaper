import { describe, expect, it } from 'vitest';
import { dropIndex } from './drop-index';

const rects = [
  { top: 0, bottom: 100 },
  { top: 100, bottom: 200 },
  { top: 200, bottom: 300 },
];

describe('dropIndex', () => {
  it('appends on an empty Worksheet', () => {
    expect(dropIndex([], 50)).toBe(0);
  });

  it('inserts before a Block when the pointer is in its upper half', () => {
    expect(dropIndex(rects, 120)).toBe(1);
  });

  it('inserts after a Block when the pointer is in its lower half', () => {
    expect(dropIndex(rects, 180)).toBe(2);
  });

  it('inserts at the start above the first Block', () => {
    expect(dropIndex(rects, -20)).toBe(0);
  });

  it('appends below the last Block', () => {
    expect(dropIndex(rects, 900)).toBe(3);
  });
});
