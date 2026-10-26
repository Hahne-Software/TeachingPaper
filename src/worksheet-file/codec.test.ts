// @vitest-environment jsdom
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { validateXML } from 'xmllint-wasm';
import schema from '../../docs/format/worksheet-1.0.xsd?raw';
import emptyExample from '../../docs/format/examples/valid/empty.xml?raw';
import { MEDIA_TYPE, decodeWorksheet, encodeWorksheet } from './codec';

const headings = [
  { type: 'heading', data: { text: 'Ancient Rome', level: 1 } },
  { type: 'heading', data: { text: 'Tasks & <more> "quotes"', level: 3 } },
  { type: 'heading', data: { text: '', level: 2 } },
  { type: 'heading', data: { text: '  padded  ', level: 2 } },
];

describe('Worksheet File codec', () => {
  it('restores Headings with texts, Heading Levels and order', () => {
    expect(decodeWorksheet(encodeWorksheet(headings))).toEqual(headings);
  });

  it('stores mimetype first and uncompressed with the exact media type', () => {
    const bytes = encodeWorksheet(headings);
    const view = new DataView(bytes.buffer, bytes.byteOffset);

    expect(strFromU8(bytes.subarray(30, 38))).toBe('mimetype');
    expect(view.getUint16(8, true)).toBe(0); // compression method: stored
    expect(strFromU8(bytes.subarray(38, 38 + MEDIA_TYPE.length))).toBe(
      'application/vnd.teachingpaper.worksheet+zip',
    );
  });

  it('writes a worksheet.xml that validates against the schema', async () => {
    const xml = strFromU8(
      unzipSync(encodeWorksheet(headings))['worksheet.xml'],
    );

    const result = await validateXML({
      xml: { fileName: 'worksheet.xml', contents: xml },
      schema: { fileName: 'worksheet-1.0.xsd', contents: schema },
    });

    expect(result.errors).toEqual([]);
  });

  it('opens the valid empty example, zipped, as an empty Worksheet', () => {
    const bytes = zipSync({
      mimetype: [strToU8(MEDIA_TYPE), { level: 0 }],
      'worksheet.xml': strToU8(emptyExample),
    });

    expect(decodeWorksheet(bytes)).toEqual([]);
  });

  it('rejects files that are not Worksheet Files', () => {
    expect(() => decodeWorksheet(strToU8('not a zip'))).toThrow();
    expect(() =>
      decodeWorksheet(zipSync({ mimetype: strToU8('text/plain') })),
    ).toThrow();
  });
});
