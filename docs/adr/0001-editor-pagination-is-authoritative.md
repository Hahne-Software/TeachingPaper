# Editor pagination is authoritative for the PDF

Teachers judge a Worksheet by what they see in the editor ("does it fit on two Pages?"), so the editor's automatic Page breaks are a promise, not a preview: the generated PDF must break Pages exactly where the editor does. This rules out a PDF renderer with its own independent layout engine (Typst, LaTeX, a PDF library laying out text itself) unless it is fed the editor's computed Page assignment; the simplest path is rendering the PDF from the same HTML/CSS layout the editor uses.

## Consequences

- Blocks never split across Pages for now; a Block that doesn't fit moves to the next Page as a whole. A Block taller than a Page gets its own Page and overflows with a visible warning.
- Page format (A4 portrait, fixed margins) is shared between editor and PDF output.
- Worksheet content uses only fonts bundled with the app, never system fonts, so text measures — and therefore paginates — identically on macOS, Windows and Linux.
