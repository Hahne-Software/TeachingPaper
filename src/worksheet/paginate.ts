export type PaginationInput = {
  /** Rendered height of each Block, in Worksheet order. */
  heights: number[];
  /** Usable content height of one Page. */
  pageHeight: number;
  /** Space between two Blocks on the same Page. */
  spacing: number;
};

export type Pagination = {
  /** Indices of the Blocks on each Page; always at least one Page. */
  pages: number[][];
  /** Blocks taller than a Page; each sits alone on its Page and overflows it. */
  oversized: Set<number>;
};

/** Distributes Blocks over Pages without ever splitting a Block. */
export const paginate = ({
  heights,
  pageHeight,
  spacing,
}: PaginationInput): Pagination => {
  const pages: number[][] = [[]];
  const oversized = new Set<number>();
  let used = 0;

  heights.forEach((height, index) => {
    const page = pages[pages.length - 1];
    const isOversized = height > pageHeight;
    if (isOversized) oversized.add(index);

    const needed = page.length === 0 ? height : used + spacing + height;
    if (page.length > 0 && (isOversized || needed > pageHeight)) {
      pages.push([index]);
      used = height;
    } else {
      page.push(index);
      used = needed;
    }
    // Nothing may share a Page with an oversized Block.
    if (isOversized) used = Infinity;
  });

  return { pages, oversized };
};
