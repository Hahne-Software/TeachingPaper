import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom has no layout; ProseMirror measures ranges when scrolling the cursor into view.
const emptyRects = () =>
  ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  }) as unknown as DOMRectList;
if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects ??= emptyRects;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
}
if (typeof Element !== 'undefined') {
  Element.prototype.getClientRects ??= emptyRects;
}
if (typeof document !== 'undefined') {
  document.elementFromPoint ??= () => null;
}

// jsdom has no ResizeObserver; this one only reports when a test calls `flushResizeObservers`.
const observers = new Set<{ callback: () => void }>();
export const flushResizeObservers = () =>
  observers.forEach((observer) => observer.callback());
if (typeof window !== 'undefined') {
  window.ResizeObserver = class {
    private readonly entry: { callback: () => void };
    constructor(callback: ResizeObserverCallback) {
      this.entry = { callback: () => callback([], this) };
      observers.add(this.entry);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      observers.delete(this.entry);
    }
  };
}
