# PDF Export prints a static export document through the WebView

Building on ADR-0001, every Export Format starts from one self-contained HTML document of the Worksheet: CSS and bundled fonts inlined, each Block rendered read-only and positioned absolutely at the Page and offset the editor computed, so nothing is measured again. The PDF Export loads that document into a hidden window and prints it to a file with each platform's native WebView print-to-PDF (WebView2 `PrintToPdf`, WebKitGTK `WebKitPrintOperation`, macOS `NSPrintOperation`), without a print dialog. This keeps the PDF identical to the editor, and an HTML Export becomes little more than saving the same document. Export Formats that are not built on HTML (DOCX, ODT) are out of scope, because their own layout would break Pages differently.

## Considered Options

- **Typst as the PDF engine:** better typography and text flowing across Pages, deterministic and testable, but a second layout engine would make the editor's Page breaks only an estimate. Kept as an idea (`docs/ideas/typst-pdf-engine.md`).
- **Browser layout drawn by a PDF library:** read line and glyph positions from the rendered DOM and place them with a PDF library. Just as faithful and free of platform code, but a growing DOM-to-PDF translator for every visual element. This is the fallback if native printing fails on a platform.
- **System print dialog (`window.print()`):** least code, but the teacher has to pick "Save as PDF", and the dialog's headers, footers and scaling can change the result. Used only in the plain browser (`pnpm dev`).
- **Printing the editor itself with print CSS:** would print the whole app window, including contenteditable and Tiptap, and does not give an HTML Export.

## Consequences

- Each Block Type has a read-only Export view that must render with the same markup and CSS as its editor view; a WebKit check compares their heights.
- Native print-to-PDF is platform code in `src-tauri/` and can only be verified in the real app on each platform (nightly builds), not in Vitest.
- PDF metadata is limited to what the document `<title>` gives each platform.
- A spike (#65) confirmed that all three platforms print the export document to a PDF without a dialog, so the browser-layout fallback is not needed. Its findings shape the export document:
  - The PDF page boxes are A4 only within about 0.5 pt (595 × 842 pt on Linux and macOS, 594.96 × 841.92 pt on Windows); tests must allow that tolerance.
  - On Linux (WebKitGTK) a Page exactly 297 mm high spills onto an extra blank page, so the export document sizes each Page 0.5 mm shorter than A4 (296.5 mm). Tests compare the PDF page count with the Page count.
  - The document waits for `document.fonts.ready` before printing, so bundled fonts are embedded.
  - On macOS the print operation must run asynchronously (`runOperationModalForWindow`); the synchronous `runOperation` blocks the main thread forever.
