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

### Worksheet Metadata

**Worksheet Metadata**:
Optional descriptive information about a Worksheet as a whole (Title, Grade Level, Subject, Topic); not printed as a Block.
_Avoid_: Header, document properties

**Title**:
The name of a Worksheet as metadata, independent of any Heading on its Pages.

**Grade Level**:
The school year (or range of years) a Worksheet is meant for, as free text such as "7", "7/8" or "Q1".
_Avoid_: Class (a specific group of students, such as 7b)

**Subject**:
The school subject a Worksheet belongs to, such as History.

**Topic**:
The teaching unit or theme within a Subject that a Worksheet covers, such as Ancient Rome.

### File format

**Worksheet File**:
A Worksheet saved to disk as a `.tpsheet` file, in the open TeachingPaper Worksheet format.
_Avoid_: Document, project file

**Unsupported Block**:
A Block from a newer Format Version that this app version does not fully understand; it is shown and kept unchanged, but can only be moved or deleted.
_Avoid_: Unknown block, placeholder

**Format Version**:
The version of the Worksheet format (MAJOR.MINOR) a Worksheet File was written in, which determines the rules that apply to it; independent of the app version.
_Avoid_: Schema version, file version

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
