# Worksheet Files are ZIP containers

A Worksheet File (`.tpsheet`) is a ZIP container from Format Version 1.0 on, not a plain XML file, even though 1.0 has no Block Type that needs anything besides the XML: images and embedded sources (other documents) are planned soon, and switching from plain XML to a container later would be a breaking MAJOR version. The layout follows ODF/EPUB: an uncompressed `mimetype` entry first (`application/vnd.teachingpaper.worksheet+zip`, so the format is recognisable from its first bytes), `worksheet.xml` with Metadata and Blocks, and `media/` for embedded files, which Blocks reference by relative path; there is no manifest.

## Considered Options

- Plain XML file: readable in a text editor and trivial for other programs, but images would have to be embedded as Base64, bloating and slowing the file.
- Plain XML now, container later: postpones the cost but forces a MAJOR version and a second reader path as soon as images arrive.
