import {
  BLOCK_SPACING,
  PAGE_CONTENT_HEIGHT,
  PAGE_HEIGHT,
  PAGE_MARGIN,
} from './page-format';
import { paginate } from './paginate';

/** Vertical gap between two Pages on screen. */
export const PAGE_GAP = 24;
/** Smallest nudge that keeps the insertion line clear of the Page edge. */
const LINE_CLEARANCE = 2;

export type Placement = { page: number; top: number; height: number };

/**
 * Positions every Block on the screen stack of A4 Pages. An oversized Block is clipped to the
 * Page's content area, so its placed height never exceeds it.
 */
export const layout = (heights: number[]) => {
  const { pages, oversized } = paginate({
    heights,
    pageHeight: PAGE_CONTENT_HEIGHT,
    spacing: BLOCK_SPACING,
  });
  const stride = PAGE_HEIGHT + PAGE_GAP;
  const placements: Placement[] = pages
    .flatMap((indices, page) =>
      indices.map((index, position) => ({
        index,
        page,
        top:
          page * stride +
          PAGE_MARGIN +
          indices
            .slice(0, position)
            .reduce((y, before) => y + heights[before] + BLOCK_SPACING, 0),
        height: Math.min(heights[index], PAGE_CONTENT_HEIGHT),
      })),
    )
    .sort((a, b) => a.index - b.index);
  return {
    placements: placements.map(({ page, top, height }) => ({
      page,
      top,
      height,
    })),
    pageHeights: pages.map(() => PAGE_HEIGHT),
    oversized,
    totalHeight: pages.length * stride - PAGE_GAP,
  };
};

/** Screen position of the line marking where a dropped Block would go. */
export const insertionTop = (index: number, placements: Placement[]) => {
  if (placements.length === 0) return PAGE_MARGIN;
  if (index >= placements.length) {
    const last = placements[placements.length - 1];
    return last.top + last.height + BLOCK_SPACING / 2;
  }
  const next = placements[index];
  const previous = placements[index - 1];
  return previous && previous.page === next.page
    ? next.top - BLOCK_SPACING / 2
    : next.top - LINE_CLEARANCE;
};
