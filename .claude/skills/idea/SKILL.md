---
name: idea
description: Capture a product idea without touching code. Use when the user starts a message with "Neue Idee:" or "New idea:".
---

# Idea capture

An idea message means: **do not change code, tests, or config.** Only research, discuss, and write down.

1. Discuss and research the idea with the user. Read code, docs, and `GLOSSARY.md` as needed; use the project's domain terms.
2. Stay in the dialogue until the user says to write it down ("schreib das weg", "write it down").
3. Write `docs/ideas/<slug>.md` from `docs/ideas/TEMPLATE.md`. Put every finding from the dialogue into it. If the idea extends an existing file, update that file instead of creating a duplicate.
4. Spawn a background agent that runs the `ideas-review` skill to refresh `docs/ideas/README.md`.
5. Report the file path in one line. Do not start implementing.

Write in English. Ideas are not issues: promote one to a GitHub issue only when the user asks, then set `issue:` in the frontmatter.
