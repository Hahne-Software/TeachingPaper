// @vitest-environment jsdom
import fc from 'fast-check';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { validateXML } from 'xmllint-wasm';
import schema from '../../docs/format/worksheet-1.0.xsd?raw';
import { blockTypes } from '../blocks/registry';
import { decodeWorksheet, encodeWorksheet, type StoredBlock } from './codec';

/** Any UTF-16 code unit, with the characters files trip over made frequent. */
const anyText = fc.string({
  unit: fc.oneof(
    fc.constantFrom('\t', '\n', '\r', '\u0000', '￿', '\ud800', '<', '&'),
    fc
      .integer({ min: 0, max: 0xffff })
      .map((code) => String.fromCharCode(code)),
  ),
});

/** The data each Block Type's editor can produce. A new Block Type needs an entry here. */
const blockData: Record<string, fc.Arbitrary<unknown>> = {
  // The Heading editor drops line breaks on Enter and on paste.
  heading: fc.record({
    text: anyText.map((text) => text.replace(/[\r\n]/g, ' ')),
    level: fc.constantFrom(1, 2, 3),
  }),
  'body-text': fc.record({
    paragraphs: fc.array(
      fc.array(
        fc.record({
          text: anyText,
          bold: fc.boolean(),
          italic: fc.boolean(),
          underline: fc.boolean(),
        }),
      ),
      { minLength: 1 },
    ),
  }),
};

const worksheets = fc.array(
  fc.oneof(
    ...Object.entries(blockData).map(([type, data]) =>
      data.map((value): StoredBlock => ({ type, data: value })),
    ),
  ),
);

const worksheetXml = (bytes: Uint8Array) =>
  strFromU8(unzipSync(bytes)['worksheet.xml']);

describe('Every Worksheet the editors can produce', () => {
  it('covers every Block Type', () => {
    expect(Object.keys(blockData).sort()).toEqual(
      Object.keys(blockTypes).sort(),
    );
  });

  it('is written as a file that opens again and saves to the same bytes', () => {
    fc.assert(
      fc.property(worksheets, (blocks) => {
        const xml = worksheetXml(encodeWorksheet(blocks));
        const reopened = decodeWorksheet(encodeWorksheet(blocks));
        expect(worksheetXml(encodeWorksheet(reopened))).toBe(xml);
      }),
    );
  });

  it('is written as a worksheet.xml that validates against the schema', async () => {
    await fc.assert(
      fc.asyncProperty(worksheets, async (blocks) => {
        const result = await validateXML({
          xml: {
            fileName: 'worksheet.xml',
            contents: worksheetXml(encodeWorksheet(blocks)),
          },
          schema: { fileName: 'worksheet-1.0.xsd', contents: schema },
        });
        expect(result.errors).toEqual([]);
      }),
      { numRuns: 30 },
    );
  });
});
