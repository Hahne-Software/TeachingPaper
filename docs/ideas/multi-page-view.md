---
status: open # open | partial | done | dropped
size: m # xs | s | m | l - rough effort of the next step
created: 2026-11-02
issue: # GitHub issue number once promoted, else empty
---

# View more than one Page at once

## Motivation

The Worksheet view shows one Page at a time over the full width. Teachers want to see how Blocks are distributed across Pages, compare neighbouring Pages, and navigate a long Worksheet quickly, and also zoom into a single Page when needed.

## Findings

- **Zoom:** the user picks the zoom level freely, including above 100 % to look closely at one Page. The Worksheet stays fully editable at every zoom level.
- **Layout presets:** two buttons next to the zoom control. "One Page over the full width" is the default view. "Two Pages side by side" is the second preset.
- **Columns follow from zoom and window width:** on very wide screens three or more Pages fit next to each other when zoomed out. The number of columns is derived, not a separate setting.
- **Overview grid:** not a zoom level but a button that opens a separate view showing all Pages as a grid. It is read-only and meant for checking, navigating and getting an overview. Clicking a Page leaves the grid and shows that Page in the editable view.
- **Persistence:** the zoom level and preset are remembered as an app setting, not saved in the Worksheet File.
- **Related:** [page-break-feedback](page-break-feedback.md). An overview makes Page breaks visible, but the two ideas stay separate.
- **Code context:** `src/worksheet/paginate.ts` distributes Blocks over Pages, and `src/components/Worksheet.tsx` renders them. The Page layout was recently made available outside the Worksheet view (#73), which the grid can build on.

## Open questions

- Does the overview grid show real scaled-down Pages with the same Blocks as the editor, or simplified thumbnails? Decide when the work starts.
- Which zoom range and steps (min, max, fit-to-width), and which keyboard shortcuts and pinch/wheel gestures?
- How do drag and drop and the Tiptap editors behave under a CSS scale or zoom (coordinates, caret, hit testing)?
- How does the overview grid handle many Pages (virtualisation, lazy rendering)?

## Steps

- [ ] Add a zoom control and scale the Page view, with the one-Page-full-width preset as default
- [ ] Lay out several Pages per row depending on zoom and window width, add the two-Pages preset
- [ ] Persist zoom level and preset as an app setting
- [ ] Add the read-only overview grid view with click-to-navigate
