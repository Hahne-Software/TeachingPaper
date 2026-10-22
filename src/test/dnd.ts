import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const rect = (top: number, height: number, left = 300, width = 600) =>
  ({
    top,
    bottom: top + height,
    height,
    left,
    right: left + width,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/** jsdom has no layout: Blocks are 100px tall, stacked; the Worksheet area is 0-1000px. */
export function stubLayout() {
  const blocks = () => Array.from(document.querySelectorAll('.block'));
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      if (this.classList.contains('block')) {
        return rect(blocks().indexOf(this) * 100, 100);
      }
      if (this.classList.contains('document-area'))
        return rect(0, 1000, 200, 800);
      if (this.classList.contains('page-stack')) return rect(0, 1000, 300, 600);
      if (this.classList.contains('palette-entry')) return rect(0, 40, 0, 200);
      if (this.classList.contains('block-grip')) return rect(0, 28, 270, 28);
      return rect(0, 0, 0, 0);
    },
  );
}

const pointer = (clientX: number, clientY: number) => ({
  clientX,
  clientY,
  button: 0,
  isPrimary: true,
  pointerId: 1,
});

const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 50)));

/** Presses `source` and drags to `to`; finish with `drop` or Escape. */
export const dragFrom = async (
  source: HTMLElement,
  to: { x: number; y: number },
  from = { x: 10, y: 10 },
) => {
  fireEvent.pointerDown(source, pointer(from.x, from.y));
  // The first move past the activation distance starts the drag; later moves track it.
  for (const offset of [0, 1, 2]) {
    fireEvent.pointerMove(document, pointer(to.x, to.y + offset));
    // dnd-kit measures the drop targets after the drag starts.
    await settle();
  }
};

export const drop = (at: { x: number; y: number }) =>
  fireEvent.pointerUp(document, pointer(at.x, at.y));

/** dnd-kit swallows the click that follows a drag until its cleanup timer has run. */
export const afterDrag = async () => {
  await settle();
  vi.restoreAllMocks();
};
