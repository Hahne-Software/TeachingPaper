---
name: ideas-review
description: Rebuild the ideas overview and find low-hanging fruits. Use after a new idea is written, or when the user asks to go through the ideas or for small, easy next steps.
---

# Ideas review

## Rebuild the overview

1. Read every `docs/ideas/*.md` except `TEMPLATE.md` and `README.md`.
2. For each idea, check the code, `git log`, and open/closed issues (`gh issue list`) to see which steps are already done. Tick finished steps and set `status` (`open`, `partial`, `done`, `dropped`) accordingly.
3. Rewrite `docs/ideas/README.md` as a table: idea (linked), status, size, what is implemented, what is still open. Sort by status, then size.

Only edit status, ticked steps, and README. Never edit code or rewrite an idea's content.

## Low-hanging fruits

When the user wants something small: list open or partial ideas with `size: xs` or `s`, or whose next step is small. For each, name the concrete step, which files it touches, and what larger idea it moves forward. Let the user pick; do not start unasked.
