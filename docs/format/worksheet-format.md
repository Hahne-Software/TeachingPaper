# TeachingPaper Worksheet Format

- **Format Version:** 1.0
- **Namespace:** `https://hahne.software/ns/teachingpaper/worksheet`
- **File extension:** `.tpsheet`
- **Media type:** `application/vnd.teachingpaper.worksheet+zip`
- **Schema:** [`worksheet-1.0.xsd`](worksheet-1.0.xsd), with [examples](examples/) of valid and invalid `worksheet.xml` files

Copyright © 2026 Hahne-Software. This specification and its XML Schema are licensed under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). Anyone may implement the format, in open or closed software, without asking.

## 1. Introduction

A Worksheet File stores one Worksheet: the document a teacher creates for students, consisting of an ordered sequence of Blocks (headings, paragraphs of text, …) and optional Worksheet Metadata. The terms used here are defined in the project [glossary](../../GLOSSARY.md).

This document is normative. The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

A **writer** is a program that creates or saves Worksheet Files; a **reader** is a program that opens them. A program that does both MUST follow both sets of rules.

## 2. Container

A Worksheet File is a ZIP archive ([APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)) with these entries:

| Entry           | Required | Content                                                                       |
| --------------- | -------- | ----------------------------------------------------------------------------- |
| `mimetype`      | yes      | The ASCII string `application/vnd.teachingpaper.worksheet+zip`, no line break |
| `worksheet.xml` | yes      | Worksheet Metadata and Blocks, see section 3                                  |
| `media/…`       | no       | Reserved for embedded files such as images (no Block Type uses it in 1.0)     |

- `mimetype` MUST be the first entry of the archive and MUST be stored without compression. Writers SHOULD NOT add an extra field to it, so that the media type appears at byte offset 38 and the format can be recognised without unpacking.
- Entries MUST be stored or compressed with Deflate; encryption MUST NOT be used. Entry names are UTF-8 and use `/` as separator.
- The archive has no manifest. Blocks of later Format Versions reference embedded files by their entry name relative to the archive root (for example `media/map.png`).
- Readers MUST preserve all entries other than `mimetype` and `worksheet.xml` unchanged when they save the Worksheet again (see section 4.3).

## 3. `worksheet.xml`

`worksheet.xml` is an XML 1.0 document encoded in UTF-8. It MUST NOT contain a document type declaration (`<!DOCTYPE …>`); readers MUST reject files that do. All elements are in the namespace `https://hahne.software/ns/teachingpaper/worksheet`; attributes are not in a namespace.

Structurally, a valid `worksheet.xml` of Format Version 1.0 validates against [`worksheet-1.0.xsd`](worksheet-1.0.xsd). The rules in this section that the schema cannot express apply as well.

### 3.1 Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="https://hahne.software/ns/teachingpaper/worksheet" version="1.0">
  <metadata>
    <title>Daily life in Ancient Rome</title>
    <grade>7</grade>
    <subject>History</subject>
    <topic>Ancient Rome</topic>
  </metadata>
  <blocks>
    <heading level="1">Daily life in Ancient Rome</heading>
    <body-text>
      <p>Read the text and mark <b>all</b> <i>Latin</i> words.<br/>Then answer the questions.</p>
      <p>Second paragraph.</p>
    </body-text>
  </blocks>
</worksheet>
```

### 3.2 Whitespace

Whitespace-only text between the children of `worksheet`, `metadata`, `blocks` and `body-text` is insignificant; writers MAY use it for indentation. All other text content is significant: readers MUST NOT trim, collapse or otherwise normalise it.

### 3.3 `worksheet`

The root element.

- Attribute `version` (required): the Format Version the file was written in, see section 4.
- Children, in this order: an optional `metadata`, then `blocks`.

### 3.4 `metadata` (Worksheet Metadata)

Optional descriptive information about the Worksheet as a whole. Each child is optional, appears at most once, and the children may appear in any order. Their content is plain text without line breaks.

| Element   | Meaning                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| `title`   | The Title of the Worksheet, independent of any Heading on its Pages                           |
| `grade`   | The Grade Level, free text such as `7`, `7/8` or `Q1` (a school year, not a class such as 7b) |
| `subject` | The Subject, such as `History`                                                                |
| `topic`   | The Topic within the Subject, such as `Ancient Rome`                                          |

Writers SHOULD omit empty elements and SHOULD omit `metadata` when it would be empty. Readers MUST treat an empty element like an absent one.

### 3.5 `blocks`

The Blocks of the Worksheet, in reading order. Each child element is one Block; its name is the Block Type. A Worksheet MAY have no Blocks. Blocks carry no identifiers.

Format Version 1.0 defines the Block Types `heading` and `body-text`.

### 3.6 `heading` (Heading)

A title or section heading.

- Attribute `level` (required): the Heading Level, an integer from `1` (most prominent) to `3`.
- Content: the heading text as plain text without line breaks. It MAY be empty.

```xml
<heading level="2">Tasks</heading>
```

### 3.7 `body-text` (Body Text)

Running text of one or more paragraphs with inline formatting.

- Children: one or more `p` elements, one per paragraph. An empty paragraph is written as `<p/>`.
- Content of `p`: text mixed with these inline elements:

| Element | Meaning                                                  |
| ------- | -------------------------------------------------------- |
| `b`     | Bold                                                     |
| `i`     | Italic                                                   |
| `u`     | Underlined                                               |
| `br`    | Line break within the paragraph (empty element, `<br/>`) |

`b`, `i` and `u` contain the same mixed content as `p` and may nest in any order and depth; a piece of text has every formatting of the elements enclosing it. Text inside `p` and its descendants MUST NOT contain the characters U+000A (line feed), U+000D (carriage return) or U+0009 (tab); a line break is always written as `br`. Readers MUST reject files that violate this.

Writers SHOULD produce one canonical form, so that equal content gives equal files:

- formatting elements nest in the order `b` › `i` › `u` (outermost first);
- adjacent text with the same formatting is merged, and formatting elements are not empty.

```xml
<body-text>
  <p>Plain, <b>bold, <i>bold and italic</i></b> and <u>underlined</u>.<br/>Next line.</p>
</body-text>
```

## 4. Versioning

### 4.1 Format Versions

A Format Version has the form `MAJOR.MINOR`, two non-negative integers without leading zeros (for example `1.0`, `1.12`). It is independent of the version of any program. Versions are compared numerically, major first: `1.10` is newer than `1.9`.

- A new **MINOR** version only adds things that a reader of an older MINOR version of the same MAJOR version can preserve without understanding them: new Block Types, new attributes or child elements of existing Blocks, new Metadata elements, new archive entries. Content written for an older MINOR version keeps its meaning.
- A new **MAJOR** version may change anything.
- The namespace never changes; only the `version` attribute identifies the Format Version.

Each Format Version has its own schema file `worksheet-MAJOR.MINOR.xsd`.

### 4.2 Writers

Writers MUST write the Format Version they implement in `version`, and only content defined by that version, except for content they preserve under section 4.3.

### 4.3 Readers

A reader implementing Format Version `M.N` handles a file of version `F` as follows:

1. **`F` has a different MAJOR version than `M`, or `version` is missing or malformed**: reject the file.
2. **`F` is `M.N` or older**: the file MUST conform to version `F` exactly; otherwise reject it (section 4.4). Read it with the rules of `F`. When saved again, the file is written as `M.N`.
3. **`F` is a newer MINOR version (`M.x` with `x` > `N`)**: read the file, and
   - a Block whose element name, attributes or descendants are not all defined in `M.N` is an **Unsupported Block**: the reader MUST keep its XML unchanged, MUST NOT let it be edited and SHOULD let it be moved and deleted; when saving, it is written back as it was;
   - children of `metadata` that are not defined in `M.N` MUST be kept and written back unchanged;
   - the reader SHOULD tell the user that the file comes from a newer Format Version.

   Everything else in the file MUST still conform to `M.N`. When saved again, such a file is written with the version `F` it was read with, since it still contains content of `F`.

In every case, readers MUST preserve archive entries other than `mimetype` and `worksheet.xml` when saving.

### 4.4 Invalid files

A reader MUST reject a file as a whole, never load it partially or repair it, if

- it is not a ZIP archive, or `mimetype` or `worksheet.xml` is missing, or `mimetype` has a different content;
- `worksheet.xml` is not well-formed XML, contains a document type declaration, or its root element is not `worksheet` in the namespace above;
- it violates a rule of this specification or the schema of its Format Version (taking section 4.3 into account).

Readers SHOULD tell the user why the file was rejected.

## 5. Changelog

### 1.0 (2026)

First version: container with `mimetype`, `worksheet.xml` and reserved `media/`; Worksheet Metadata `title`, `grade`, `subject`, `topic`; Block Types `heading` and `body-text`.
