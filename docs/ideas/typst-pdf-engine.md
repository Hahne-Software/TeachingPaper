---
status: open # open | partial | done | dropped
size: l # xs | s | m | l - rough effort of the next step
created: 2026-11-01
issue: # GitHub issue number once promoted, else empty
---

# Typst as the layout engine for the PDF Export

## Motivation

A typesetting engine would print Worksheets with better typography than a browser and could let Body Text flow across Pages, at the price of the PDF no longer matching the editor exactly.

## Findings

- **Context:** while designing the first PDF Export (2026-11-01) three ways were weighed: (a) print the editor's own HTML/CSS layout to PDF through the WebView's native print-to-PDF, (b) Typst, (c) read line positions from the rendered DOM and draw them with a PDF library. (a) was chosen because the Export should look as much like the editor as possible; (c) is the fallback if (a) fails on a platform. This idea keeps (b) for later.
- **Gains:** hyphenation and better line and paragraph breaking; Body Text could flow across Pages (Variant 2 in [page-break-feedback](page-break-feedback.md)); no platform-specific print code, since Typst runs as a Rust crate in the Tauri backend; deterministic output that `cargo test` can snapshot; Worksheet Metadata in the PDF, PDF/A and tagged (accessible) PDF.
- **Costs:** a second layout engine next to the editor's HTML/CSS. The editor would break lines and Pages differently from the PDF, so its Page breaks would become an estimate, or the editor would have to ask Typst for them. Either way this supersedes ADR-0001 and rethinks what the editor promises.
- **Per Block Type:** every Block Type would need a Typst rendering besides its editor view.
- **HTML Export:** Typst's HTML output was still experimental at the time, so an HTML Export Format would need its own path.

## Open questions

- Should the editor take its Page breaks from Typst (round trip to the backend on every edit), or only approximate them?
- Is fidelity to the editor still the main promise once Body Text can flow across Pages?
- How fast is a Typst compile of a typical Worksheet, and is it fast enough for live Page breaks?

## Steps

- [ ] Spike: render a sample Worksheet (Headings, Body Text with bold/italic/underline) with the Typst crate and compare it with the editor and the WebView PDF
- [ ] Decide whether the gains justify replacing ADR-0001
