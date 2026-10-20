---
status: open # open | partial | done | dropped
size: l # xs | s | m | l - rough effort of the next step
created: 2026-10-20
issue: # GitHub issue number once promoted, else empty
---

# AI text revision for Body Text Blocks

## Motivation

Teachers write Worksheet text under time pressure. An AI can fix spelling and adapt the language to the students' grade level, saving time and making Worksheets more accessible.

## Findings

- **Location:** the Properties Panel of the selected Body Text Block (Heading may follow later).
- **Actions are fixed buttons.** The teacher cannot enter a free prompt. Prompts are owned by the app.
  - Fix spelling
  - Simplify language
  - Adapt language to a grade level: grades 1-4, 5-7, 8-10, upper secondary (Oberstufe)
- **Scope:** the whole Block text. Revising only a selection is a possible later extension.
- **Preview and confirmation:** the result is shown as a preview (ideally a diff). The teacher must explicitly accept or discard it; accepting is undoable. Reason: the AI can distort content such as technical terms, numbers or task wording.
- **Formatting is preserved:** bold, italic and underline must survive the revision. The AI receives structured text and returns structured text (see ADR 0002, own Body Text format).
- **Language is detected automatically.** The text is mostly German, but foreign-language lessons are possible.
- **AI connection, in phases:**
  1. Bring your own key: the teacher stores their own API key.
  2. Maybe later: a token system where we host the model and sell a usage quota.
  3. Long-term goal: local models, everything runs on the teacher's computer. Keep this in view from the start.
- The AI access should sit behind a swappable provider interface so the three phases do not change the feature itself.

## Open questions

- Where is the API key stored? Preferably the OS keychain via Tauri, not plain text in settings.
- Privacy: with BYOK the text leaves the computer. Show a hint (e.g. no student names in the text)? What does the GDPR require?
- Which provider(s) to support first for BYOK?
- Which local models are good enough for German text revision, and what hardware do they need?
- How to guarantee that formatting survives (structured output vs. mapping marks back onto the revised text)?
- Does the diff preview work at word level, and how are formatting changes shown?
- Offline behaviour: the buttons are disabled without a connection or key, with a clear message?

## Steps

- [ ] Define the provider interface and a fake provider for tests
- [ ] Settings: store the API key in the OS keychain
- [ ] Properties Panel buttons for the three actions on Body Text
- [ ] Preview with accept/discard, formatting preserved
- [ ] First real provider (BYOK)
