import { describe, expect, it } from 'vitest';
import { paginate } from './paginate';

const run = (heights: number[], pageHeight = 100, spacing = 0) =>
  paginate({ heights, pageHeight, spacing });

describe('paginate', () => {
  it('gives an empty Worksheet one empty Page', () => {
    expect(run([])).toEqual({ pages: [[]], oversized: new Set() });
  });

  it('keeps Blocks that exactly fill a Page on that Page', () => {
    expect(run([40, 60]).pages).toEqual([[0, 1]]);
  });

  it('moves a Block that does not fit whole to the next Page', () => {
    expect(run([40, 61, 10]).pages).toEqual([[0], [1, 2]]);
  });

  it('counts spacing between Blocks toward the Page height', () => {
    expect(run([40, 60], 100, 10).pages).toEqual([[0], [1]]);
    expect(run([40, 50], 100, 10).pages).toEqual([[0, 1]]);
  });

  it('does not count spacing above the first Block of a Page', () => {
    expect(run([60, 100], 100, 10).pages).toEqual([[0], [1]]);
  });

  it('gives an oversized Block its own Page and flags it', () => {
    const result = run([30, 150, 20]);
    expect(result.pages).toEqual([[0], [1], [2]]);
    expect(result.oversized).toEqual(new Set([1]));
  });

  it('handles an oversized first Block', () => {
    const result = run([150, 20]);
    expect(result.pages).toEqual([[0], [1]]);
    expect(result.oversized).toEqual(new Set([0]));
  });

  it('handles an oversized last Block', () => {
    const result = run([20, 150]);
    expect(result.pages).toEqual([[0], [1]]);
    expect(result.oversized).toEqual(new Set([1]));
  });

  it('leaves no trailing blank Page after an oversized last Block', () => {
    expect(run([150]).pages).toEqual([[0]]);
  });
});
