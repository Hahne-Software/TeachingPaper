export type VerticalRect = { top: number; bottom: number };

/** Index in the flat Block list where a drop at `pointerY` would insert. */
export const dropIndex = (rects: VerticalRect[], pointerY: number): number => {
  const index = rects.findIndex(
    (rect) => pointerY < (rect.top + rect.bottom) / 2,
  );
  return index === -1 ? rects.length : index;
};
