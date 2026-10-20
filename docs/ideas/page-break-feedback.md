---
status: open # open | partial | done | dropped
size: m # xs | s | m | l - rough effort of the next step
created: 2026-10-20
issue: # GitHub issue number once promoted, else empty
---

# Clearer feedback when a Block hits a Page break

## Motivation

While typing in a Body Text Block, the Block jumps to the next Page as soon as it no longer fits on the rest of its Page, without any explanation. Teachers do not see why their text moved.

## Findings

- **Current behaviour (ADR-0001, issue #7):** Blocks are never split. A Block that does not fit on the rest of a Page moves as a whole to the next Page. Only a Block taller than a whole Page is clipped and shows a warning.
- **Why it confuses:** the behaviour depends on the Page content. A Body Text Block alone on a Page stays and is clipped from 979 px on. The same Block after a Heading jumps to the next Page at about 930 px, and no warning appears in between. The Block also moves away under the caret.
- **Why not keep the Block in place while typing:** the editor must show exactly what the PDF prints, so the Block would have to be shown in a different place than it prints.
- **Variant 1, hint on jump:** a short, unobtrusive notice when a Block moves, e.g. "Moved to next Page: it no longer fits here". Cheap, no change to ADR-0001.
- **Variant 2, splittable Body Text:** text flows across the Page break like in Word. This is the clean fix but changes ADR-0001 and the pagination function: pagination would need to measure and split paragraphs or lines, and the PDF would have to break at the same lines.

## Open questions

- Where does the hint show (in the Page margin, next to the Block, a toast) and how long does it stay?
- For splittable text: split at paragraph or at line level, and are widows and orphans avoided?
- Does a split Body Text stay one Block in the Worksheet, with the Page break only a derived view?
- Do other Block Types (Heading) stay unsplittable?

## Steps

- [ ] Prototype the jump hint (Variant 1) and try it on a real Worksheet
- [ ] Decide whether splittable Body Text is worth an ADR change
