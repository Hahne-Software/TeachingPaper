# Testing dnd-kit drags in jsdom

Drive drags with `fireEvent.pointerDown` on the draggable and `fireEvent.pointerMove` / `pointerUp` on `document`. jsdom has no layout, so stub `Element.prototype.getBoundingClientRect` per class (see `src/components/palette-drag.test.tsx`).

- The first pointer move past the activation distance only starts the drag; `onDragMove` fires from the next move. Send at least two moves, with `await act(() => new Promise((r) => setTimeout(r, 50)))` between them, because dnd-kit measures drop targets after the drag starts.
- Finish every drag (`pointerUp` or Escape). An unfinished drag leaks into the next test.
- dnd-kit swallows the first click after a drag until its cleanup timer runs; wait 50 ms in `afterEach`.
- Inspect values by throwing an `Error` with the value in the test. The RTK hook filters `console.log` output.
- jsdom cannot show scrolling mid-drag or focus and caret behaviour: verify those per `browser-verification.md`.
- The Block inserted last is selected and keeps the focus (`autoFocus`): clicking another Block's text does not select it in jsdom. Drag the last Block, or assert selection through a Block you inserted last.
