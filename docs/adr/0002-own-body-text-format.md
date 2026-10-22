# Body Text is stored in our own format, not the editor library's

Body Text content is stored as our own minimal structure (paragraphs of text runs with bold/italic/underline flags; a line break within a paragraph, entered with Shift+Enter, is stored as a newline character in the run text) and the rich-text editor (Tiptap) only converts to and from it. Storing Tiptap/ProseMirror JSON directly would be less code, but the Worksheet XML is the product's file format and must not inherit a third-party schema or break when we upgrade or swap the editor library.
