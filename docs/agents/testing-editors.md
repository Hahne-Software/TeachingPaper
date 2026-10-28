# Testing editors in jsdom

jsdom has no layout and ProseMirror reads DOM mutations asynchronously, so editor tests need these habits:

- Layout stubs (`getClientRects`, `elementFromPoint`) live in `src/test/setup.ts`; extend them there when ProseMirror asks for another browser API.
- Test Enter, Shift+Enter, selection formatting and paste on a headless `new Editor({ extensions })` with commands (`splitBlock`, `setHardBreak`, `toggleMark`) and `DOMParser.fromSchema(editor.schema)`.
- In component tests, wait for focus (`await waitFor(() => expect(editor).toHaveFocus())`) before `userEvent.keyboard`, and wrap every assertion on editor output in `waitFor`.
- Seed content through `data` and select it with `{Control>}a{/Control}`; typed text through `userEvent.keyboard` is flaky.

## Heading and other `contenteditable="plaintext-only"` Blocks

jsdom does not treat `plaintext-only` as editable, so `userEvent.keyboard` types nothing into a Heading. Set `textContent` on the element and fire `fireEvent.input`. Find Headings with `.heading`: `getByRole('heading')` also matches the Block Palette's own heading.
