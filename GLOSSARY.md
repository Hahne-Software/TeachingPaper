# TeachingPaper

A desktop editor in which teachers compose worksheets for students out of predefined content blocks; worksheets are later rendered as PDF.

## Language

### Worksheet structure

**Worksheet**:
The document a teacher creates for students: an ordered sequence of Blocks laid out on one or more Pages.
_Avoid_: Document, sheet, paper

**Page**:
One printed sheet of a Worksheet; Blocks are distributed across Pages automatically.
_Avoid_: Sheet

**Block**:
A single piece of content placed in a Worksheet, such as a heading or a paragraph of text.
_Avoid_: Element, component, widget

**Block Type**:
The kind of a Block, which determines what content and settings the Block has.
_Avoid_: Template

### Block Types

**Heading**:
A Block Type for a title or section heading, with a Heading Level.

**Heading Level**:
The rank of a Heading (1–3), which determines its visual size and weight.
_Avoid_: Heading size, font size

**Body Text**:
A Block Type for running text of one or more paragraphs with inline formatting (bold, italic, underline).
_Avoid_: Text block

### Editor

**Block Palette**:
The sidebar listing the available Block Types, from which Blocks are added to the Worksheet.
_Avoid_: Toolbox, library, sidebar

**Properties Panel**:
The sidebar showing the settings of the selected Block.
_Avoid_: Inspector, settings panel
