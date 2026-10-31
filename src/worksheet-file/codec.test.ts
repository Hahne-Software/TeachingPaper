// @vitest-environment jsdom
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { validateXML } from 'xmllint-wasm';
import schema from '../../docs/format/worksheet-1.0.xsd?raw';
import emptyExample from '../../docs/format/examples/valid/empty.xml?raw';
import ancientRome from '../../docs/format/examples/valid/ancient-rome.xml?raw';
import emptyBodyText from '../../docs/format/examples/invalid/empty-body-text.xml?raw';
import unknownInline from '../../docs/format/examples/invalid/unknown-inline-element.xml?raw';
import partialMetadata from '../../docs/format/examples/valid/partial-metadata.xml?raw';
import duplicateMetadata from '../../docs/format/examples/invalid/duplicate-metadata-element.xml?raw';
import metadataAfterBlocks from '../../docs/format/examples/invalid/metadata-after-blocks.xml?raw';
import { emptyMetadata } from '../worksheet/metadata';
import {
  MEDIA_TYPE,
  decodeWorksheet,
  encodeWorksheet,
  readWorksheet,
  type StoredBlock,
} from './codec';
import { noRetained } from '../worksheet/retained';
import { UNSUPPORTED_BLOCK } from '../worksheet/unsupported';

const encodeBlocks = (blocks: StoredBlock[]) =>
  encodeWorksheet({ metadata: emptyMetadata, blocks });
const decodeBlocks = (bytes: Uint8Array) => decodeWorksheet(bytes).blocks;

const validExamples = Object.entries(
  import.meta.glob<string>('../../docs/format/examples/valid/*.xml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).map(([path, contents]) => ({ name: path.split('/').pop(), contents }));

const headings = [
  { type: 'heading', data: { text: 'Ancient Rome', level: 1 } },
  { type: 'heading', data: { text: 'Tasks & <more> "quotes"', level: 3 } },
  { type: 'heading', data: { text: '', level: 2 } },
  { type: 'heading', data: { text: '  padded  ', level: 2 } },
];

const run = (
  text: string,
  { bold = false, italic = false, underline = false } = {},
) => ({ text, bold, italic, underline });

const bodyText = (...paragraphs: ReturnType<typeof run>[][]) => ({
  type: 'body-text',
  data: { paragraphs },
});

const zipXml = (xml: string) =>
  zipSync({
    mimetype: [strToU8(MEDIA_TYPE), { level: 0 }],
    'worksheet.xml': strToU8(xml),
  });

const withBlocks = (blocks: string) =>
  zipXml(
    `<worksheet xmlns="https://hahne.software/ns/teachingpaper/worksheet" version="1.0"><blocks>${blocks}</blocks></worksheet>`,
  );

// The example of section 3.7 of the format spec.
const specExample = bodyText([
  run('Plain, '),
  run('bold, ', { bold: true }),
  run('bold and italic', { bold: true, italic: true }),
  run(' and '),
  run('underlined', { underline: true }),
  run('.\nNext line.'),
]);

const mixed = [
  headings[0],
  specExample,
  headings[1],
  bodyText([]),
  headings[2],
];

const worksheetXml = (bytes: Uint8Array) =>
  strFromU8(unzipSync(bytes)['worksheet.xml']);

describe('Worksheet File codec', () => {
  it('restores a plain Body Text paragraph', () => {
    const blocks = [bodyText([run('Read the text.')])];

    expect(decodeBlocks(encodeBlocks(blocks))).toEqual(blocks);
  });

  it('restores every combination of bold, italic and underline', () => {
    const combinations = [false, true].flatMap((bold) =>
      [false, true].flatMap((italic) =>
        [false, true].map((underline) => ({ bold, italic, underline })),
      ),
    );
    // Each combination next to every other one, so every transition is written.
    const runs = combinations.flatMap((first, index) =>
      combinations
        .filter((second) => second !== first)
        .map((second) => [run(`a${index}`, first), run(`b${index}`, second)]),
    );
    const blocks = [bodyText(...runs)];

    expect(decodeBlocks(encodeBlocks(blocks))).toEqual(blocks);
  });

  it('restores line breaks, empty paragraphs and multiple paragraphs', () => {
    const blocks = [
      bodyText(
        [run('\nstarts with a break')],
        [],
        [run('ends with a break\n')],
        [run('\n\n')],
        [
          run('plain\n'),
          run('\nbold\nand\n', { bold: true }),
          run('\n', { bold: true, italic: true, underline: true }),
          run('underlined\n', { underline: true }),
        ],
        [],
      ),
    ];

    expect(decodeBlocks(encodeBlocks(blocks))).toEqual(blocks);
  });

  it.each([
    ['line feed', '<p>one\ntwo</p>'],
    ['carriage return', '<p>one&#13;two</p>'],
    ['tab', '<p><b>one\ttwo</b></p>'],
  ])('rejects a raw %s in Body Text', (_, paragraph) => {
    expect(() =>
      decodeBlocks(withBlocks(`<body-text>${paragraph}</body-text>`)),
    ).toThrow();
  });

  it('writes tabs as spaces and carriage returns as line breaks', () => {
    const pasted = bodyText([run('a\tb\r\nc\rd', { bold: true })]);

    expect(decodeBlocks(encodeBlocks([pasted]))).toEqual([
      bodyText([run('a b\nc\nd', { bold: true })]),
    ]);
  });

  it('leaves out characters XML cannot hold', () => {
    const blocks = [
      { type: 'heading', data: { text: 'a\u0000b\u000bc\ud800', level: 1 } },
      bodyText([run('d\u0007e\u000cf\uffff')]),
    ];

    expect(decodeBlocks(encodeBlocks(blocks))).toEqual([
      { type: 'heading', data: { text: 'abc', level: 1 } },
      bodyText([run('def')]),
    ]);
  });

  it('writes no empty formatting for text XML cannot hold', () => {
    const blocks = [
      bodyText(
        [run('\u0000', { bold: true })],
        [run('x', { italic: true }), run('\ud800'), run('y', { italic: true })],
      ),
    ];

    expect(worksheetXml(encodeBlocks(blocks))).toContain(
      '      <p/>\n      <p><i>xy</i></p>',
    );
  });

  it('keeps the order of mixed Headings and Body Texts', () => {
    expect(decodeBlocks(encodeBlocks(mixed))).toEqual(mixed);
  });

  it('writes Body Text in the canonical form of the spec', () => {
    expect(worksheetXml(encodeBlocks([specExample]))).toContain(
      [
        '    <body-text>',
        '      <p>Plain, <b>bold, <i>bold and italic</i></b> and <u>underlined</u>.<br/>Next line.</p>',
        '    </body-text>',
      ].join('\n'),
    );
  });

  it('writes equal bytes for equal content', () => {
    const split = bodyText([
      run(''),
      run('Plain'),
      run(', ', {}),
      run('', { italic: true }),
      run('bold, ', { bold: true }),
      run('bold and ', { bold: true, italic: true }),
      run('italic', { bold: true, italic: true }),
      run(' and '),
      run('underlined', { underline: true }),
      run('.\n'),
      run('Next line.'),
    ]);

    expect(worksheetXml(encodeBlocks([split]))).toBe(
      worksheetXml(encodeBlocks([specExample])),
    );
  });

  it('reads b, i and u in any nesting order and redundant nesting', () => {
    const bytes = withBlocks(
      '<body-text><p><u><i><b>all</b></i></u> <i>it<i>al<b>ic</b></i></i><b><br/></b></p></body-text>',
    );

    expect(decodeBlocks(bytes)).toEqual([
      bodyText([
        run('all', { bold: true, italic: true, underline: true }),
        run(' '),
        run('ital', { italic: true }),
        run('ic', { bold: true, italic: true }),
        run('\n', { bold: true }),
      ]),
    ]);
  });

  it('reads CDATA sections in Body Text as text', () => {
    const bytes = withBlocks(
      '<body-text><p>a <![CDATA[<b>not bold</b>]]></p></body-text>',
    );

    expect(decodeBlocks(bytes)).toEqual([bodyText([run('a <b>not bold</b>')])]);
  });

  it.each(validExamples)('opens valid/$name, zipped', ({ contents }) => {
    expect(() => decodeBlocks(zipXml(contents))).not.toThrow();
  });

  it('opens the Ancient Rome example with its Body Text', () => {
    expect(decodeBlocks(zipXml(ancientRome))).toEqual([
      {
        type: 'heading',
        data: { text: 'Daily life in Ancient Rome', level: 1 },
      },
      bodyText(
        [
          run('Read the text and mark '),
          run('all', { bold: true }),
          run(' '),
          run('Latin', { italic: true }),
          run(' words.\nThen answer the questions.'),
        ],
        [],
        [
          run('Plain, '),
          run('bold, ', { bold: true }),
          run('bold and italic', { bold: true, italic: true }),
          run(' and '),
          run('underlined', { underline: true }),
          run('.'),
        ],
      ),
      { type: 'heading', data: { text: 'Tasks', level: 2 } },
      { type: 'heading', data: { text: '', level: 3 } },
    ]);
  });

  it.each([
    ['invalid/empty-body-text.xml', emptyBodyText],
    ['invalid/unknown-inline-element.xml', unknownInline],
  ])('rejects %s', (_, contents) => {
    expect(() => decodeBlocks(zipXml(contents))).toThrow();
  });

  it.each([
    ['text outside a paragraph', '<body-text>stray<p/></body-text>'],
    [
      'a no-break space outside a paragraph',
      '<body-text>\u00a0<p/></body-text>',
    ],
    [
      'a paragraph in another namespace',
      '<body-text><p xmlns="urn:x"/></body-text>',
    ],
    [
      'formatting in another namespace',
      '<body-text><p><b xmlns="urn:x">x</b></p></body-text>',
    ],
    ['a line break with content', '<body-text><p><br>x</br></p></body-text>'],
  ])('rejects Body Text with %s', (_, blockXml) => {
    expect(() => decodeBlocks(withBlocks(blockXml))).toThrow();
  });

  it('restores Headings with texts, Heading Levels and order', () => {
    expect(decodeBlocks(encodeBlocks(headings))).toEqual(headings);
  });

  it('stores mimetype first and uncompressed with the exact media type', () => {
    const bytes = encodeBlocks(headings);
    const view = new DataView(bytes.buffer, bytes.byteOffset);

    expect(strFromU8(bytes.subarray(30, 38))).toBe('mimetype');
    expect(view.getUint16(8, true)).toBe(0); // compression method: stored
    expect(strFromU8(bytes.subarray(38, 38 + MEDIA_TYPE.length))).toBe(
      'application/vnd.teachingpaper.worksheet+zip',
    );
  });

  it('writes a worksheet.xml that validates against the schema', async () => {
    const xml = worksheetXml(encodeBlocks(mixed));

    const result = await validateXML({
      xml: { fileName: 'worksheet.xml', contents: xml },
      schema: { fileName: 'worksheet-1.0.xsd', contents: schema },
    });

    expect(result.errors).toEqual([]);
  });

  it('opens the valid empty example, zipped, as an empty Worksheet', () => {
    expect(decodeBlocks(zipXml(emptyExample))).toEqual([]);
  });

  it('rejects files that are not Worksheet Files', () => {
    expect(() => decodeBlocks(strToU8('not a zip'))).toThrow();
    expect(() =>
      decodeBlocks(zipSync({ mimetype: strToU8('text/plain') })),
    ).toThrow();
  });
});

const metadata = {
  title: 'Daily life in Ancient Rome',
  gradeLevel: '7/8',
  subject: 'History & <Latin>',
  topic: '  Ancient Rome  ',
};

const withMetadata = (metadataXml: string) =>
  zipXml(
    `<worksheet xmlns="https://hahne.software/ns/teachingpaper/worksheet" version="1.0"><metadata>${metadataXml}</metadata><blocks/></worksheet>`,
  );

describe('Worksheet Metadata in Worksheet Files', () => {
  it('restores every Metadata field', () => {
    const worksheet = { metadata, blocks: headings, retained: noRetained };

    expect(decodeWorksheet(encodeWorksheet(worksheet))).toEqual(worksheet);
  });

  it('leaves out empty fields, and the whole metadata when all are empty', () => {
    const partial = { ...emptyMetadata, title: 'Rome', topic: 'Forum' };

    expect(
      worksheetXml(encodeWorksheet({ metadata: partial, blocks: [] })),
    ).toContain(
      [
        '  <metadata>',
        '    <title>Rome</title>',
        '    <topic>Forum</topic>',
        '  </metadata>',
      ].join('\n'),
    );
    expect(
      worksheetXml(encodeWorksheet({ metadata: emptyMetadata, blocks: [] })),
    ).not.toContain('metadata');
  });

  it('writes line breaks in Metadata as spaces', () => {
    const pasted = { ...emptyMetadata, title: 'Daily\nlife\r\nin Rome' };

    expect(
      decodeWorksheet(encodeWorksheet({ metadata: pasted, blocks: [] }))
        .metadata.title,
    ).toBe('Daily life in Rome');
  });

  it('reads Metadata in any order and treats empty elements as absent', () => {
    expect(decodeWorksheet(zipXml(partialMetadata)).metadata).toEqual({
      ...emptyMetadata,
      gradeLevel: '5/6',
      topic: 'Fractions',
    });
    expect(
      decodeWorksheet(withMetadata('<subject/><title></title>')).metadata,
    ).toEqual(emptyMetadata);
  });

  it.each([
    ['invalid/duplicate-metadata-element.xml', duplicateMetadata],
    ['invalid/metadata-after-blocks.xml', metadataAfterBlocks],
  ])('rejects %s', (_, contents) => {
    expect(() => decodeWorksheet(zipXml(contents))).toThrow();
  });

  it.each([
    ['a line break', '<title>one\ntwo</title>'],
    ['an unknown element', '<author>Me</author>'],
    ['a field twice, once empty', '<grade/><grade>7</grade>'],
    ['an element inside a field', '<title><b>x</b></title>'],
    ['a field in another namespace', '<title xmlns="urn:x">x</title>'],
    ['text between fields', '<title>x</title>stray'],
  ])('rejects Metadata with %s', (_, metadataXml) => {
    expect(() => decodeWorksheet(withMetadata(metadataXml))).toThrow();
  });

  it('writes Metadata that validates against the schema', async () => {
    const xml = worksheetXml(encodeWorksheet({ metadata, blocks: mixed }));

    const result = await validateXML({
      xml: { fileName: 'worksheet.xml', contents: xml },
      schema: { fileName: 'worksheet-1.0.xsd', contents: schema },
    });

    expect(result.errors).toEqual([]);
  });
});

describe('rejecting invalid Worksheet Files', () => {
  const NS = 'https://hahne.software/ns/teachingpaper/worksheet';
  const sheet = (attrs: string, body = '<blocks/>') =>
    zipXml(`<worksheet xmlns="${NS}" ${attrs}>${body}</worksheet>`);
  const reasonOf = (bytes: Uint8Array) => {
    const result = readWorksheet(bytes);
    if (result.ok) throw new Error('expected a rejection');
    return result.reason;
  };

  it.each([
    ['not a ZIP', strToU8('hello'), 'not a ZIP'],
    [
      'a wrong mimetype',
      zipSync({ mimetype: strToU8('text/plain') }),
      'mimetype',
    ],
    [
      'a missing worksheet.xml',
      zipSync({ mimetype: strToU8(MEDIA_TYPE) }),
      'worksheet.xml is missing',
    ],
    ['malformed XML', zipXml('<worksheet'), 'not well-formed'],
    [
      'a document type declaration',
      zipXml('<!DOCTYPE worksheet []><worksheet/>'),
      'document type declaration',
    ],
    [
      'a wrong root element',
      zipXml(`<sheet xmlns="${NS}"/>`),
      'not a worksheet',
    ],
    [
      'a wrong namespace',
      zipXml('<worksheet version="1.0"/>'),
      'not a worksheet',
    ],
    ['a missing version', sheet(''), 'missing or malformed'],
    ['a malformed version', sheet('version="1.x"'), 'missing or malformed'],
    ['a different MAJOR version', sheet('version="2.0"'), 'Format Version 2.0'],
    [
      'an unknown Block Type',
      sheet('version="1.0"', '<blocks><video/></blocks>'),
      'unknown Block Type "video"',
    ],
    [
      'a Heading Level out of range',
      sheet('version="1.0"', '<blocks><heading level="4"/></blocks>'),
      'Heading Level',
    ],
    [
      'a raw line break in a Paragraph',
      sheet(
        'version="1.0"',
        '<blocks><body-text><p>a\nb</p></body-text></blocks>',
      ),
      'raw line break',
    ],
    [
      'a raw line break in a Heading',
      sheet(
        'version="1.0"',
        '<blocks><heading level="1">a\nb</heading></blocks>',
      ),
      'Heading contains a raw line break',
    ],
  ])('rejects %s with an understandable reason', (_, bytes, reason) => {
    expect(reasonOf(bytes)).toContain(reason);
  });

  it('rejects every invalid example, zipped', () => {
    const invalid = Object.values(
      import.meta.glob<string>('../../docs/format/examples/invalid/*.xml', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    );
    expect(invalid.length).toBeGreaterThan(0);
    invalid.forEach((xml) => expect(readWorksheet(zipXml(xml)).ok).toBe(false));
  });

  it('reads a valid file as a result', () => {
    expect(readWorksheet(encodeBlocks(headings))).toEqual({
      ok: true,
      worksheet: {
        metadata: emptyMetadata,
        blocks: headings,
        retained: noRetained,
      },
    });
  });
});

describe('newer MINOR Format Versions', () => {
  const NS = 'https://hahne.software/ns/teachingpaper/worksheet';
  const sheet = (blocks: string, metadata = '', version = '1.1') =>
    `<worksheet xmlns="${NS}" version="${version}">${metadata}<blocks>${blocks}</blocks></worksheet>`;
  const zipWith = (xml: string, extra: Record<string, Uint8Array> = {}) =>
    zipSync({
      mimetype: [strToU8(MEDIA_TYPE), { level: 0 }],
      'worksheet.xml': strToU8(xml),
      ...extra,
    });
  const savedXml = (bytes: Uint8Array) =>
    strFromU8(unzipSync(bytes)['worksheet.xml']);
  const roundTrip = (bytes: Uint8Array) =>
    encodeWorksheet(decodeWorksheet(bytes));

  const map = '<map zoom="3"><pin x="1"/></map>';
  const attributed = '<heading level="2" color="red">Rome</heading>';

  it('reads unknown Block Types and unknown attributes as Unsupported Blocks', () => {
    const { blocks } = decodeWorksheet(
      zipWith(sheet(`${map}<heading level="1">A</heading>${attributed}`)),
    );
    expect(blocks.map((b) => b.type)).toEqual([
      UNSUPPORTED_BLOCK,
      'heading',
      UNSUPPORTED_BLOCK,
    ]);
  });

  it.each([
    ['an unknown child of a Heading', '<heading level="1"><x/></heading>'],
    [
      'an unknown inline element',
      '<body-text><p><mark>a</mark></p></body-text>',
    ],
    [
      'an unknown attribute on a paragraph',
      '<body-text><p a="1">a</p></body-text>',
    ],
    [
      'an unknown attribute on a line break',
      '<body-text><p>a<br x="1"/></p></body-text>',
    ],
    [
      'an unknown element in Body Text',
      '<body-text><list/><p>a</p></body-text>',
    ],
  ])('reads %s as an Unsupported Block', (_, block) => {
    expect(decodeWorksheet(zipWith(sheet(block))).blocks[0].type).toBe(
      UNSUPPORTED_BLOCK,
    );
  });

  it('still rejects violations of known content', () => {
    const result = readWorksheet(
      zipWith(sheet('<heading level="9">A</heading>')),
    );
    expect(result.ok).toBe(false);
  });

  it('writes Unsupported Blocks back exactly and keeps the read version', () => {
    const xml = savedXml(roundTrip(zipWith(sheet(`${map}${attributed}`))));
    expect(xml).toContain(`    ${map}\n`);
    expect(xml).toContain(`    ${attributed}\n`);
    expect(xml).toContain('version="1.1"');
  });

  it('keeps an Unsupported Block with foreign namespaces and its descendants', () => {
    const block =
      '<chart xmlns:x="urn:x" x:kind="bar"><x:series><point>1</point></x:series></chart>';
    const again = roundTrip(zipWith(sheet(block)));
    expect(decodeWorksheet(again).blocks).toEqual(
      decodeWorksheet(zipWith(sheet(block))).blocks,
    );
    expect(savedXml(again)).toContain('x:kind="bar"');
  });

  it('keeps our namespace on descendants of a foreign root', () => {
    const block = `<x:chart xmlns:x="urn:x"><bar xmlns="${NS}"/></x:chart>`;
    const bytes = zipWith(sheet(block));
    const { blocks } = decodeWorksheet(roundTrip(bytes));
    expect(blocks).toEqual(decodeWorksheet(bytes).blocks);
    expect((blocks[0].data as { xml: string }).xml).toContain(
      `<bar xmlns="${NS}"/>`,
    );
  });

  it('keeps unknown Worksheet Metadata next to the known fields', () => {
    const metadata =
      '<metadata><title>T</title><license>CC0</license><tags a="1"><t>x</t></tags></metadata>';
    const bytes = zipWith(sheet('', metadata));
    const worksheet = decodeWorksheet(bytes);
    expect(worksheet.metadata.title).toBe('T');
    const xml = savedXml(encodeWorksheet(worksheet));
    expect(xml).toContain('<license>CC0</license>');
    expect(xml).toContain('<tags a="1"><t>x</t></tags>');
    expect(xml).toContain('<title>T</title>');
    expect(decodeWorksheet(encodeWorksheet(worksheet))).toEqual(worksheet);
  });

  it('writes unknown Worksheet Metadata even when no known field is set', () => {
    const worksheet = decodeWorksheet(
      zipWith(sheet('', '<metadata><license>CC0</license></metadata>')),
    );
    expect(savedXml(encodeWorksheet(worksheet))).toContain(
      '<license>CC0</license>',
    );
  });

  it('keeps other archive entries byte for byte, for every version', () => {
    const png = Uint8Array.from([137, 80, 78, 71, 0, 255, 1, 2, 3, 200]);
    const extra = { 'media/map.png': png, 'notes/readme.txt': strToU8('hi') };
    ['1.0', '1.1'].forEach((version) => {
      const out = unzipSync(roundTrip(zipWith(sheet('', '', version), extra)));
      expect(Array.from(out['media/map.png'])).toEqual(Array.from(png));
      expect(strFromU8(out['notes/readme.txt'])).toBe('hi');
      expect(strFromU8(out.mimetype)).toBe(MEDIA_TYPE);
    });
  });

  it('keeps mimetype first and uncompressed', () => {
    const bytes = roundTrip(
      zipWith(sheet(''), { 'media/a.png': Uint8Array.of(1) }),
    );
    expect(strFromU8(bytes.slice(30, 30 + 8))).toBe('mimetype');
  });

  it('writes 1.0 for files read as 1.0 and for new Worksheets', () => {
    expect(savedXml(roundTrip(zipWith(sheet('', '', '1.0'))))).toContain(
      'version="1.0"',
    );
    expect(
      savedXml(encodeWorksheet({ metadata: emptyMetadata, blocks: [] })),
    ).toContain('version="1.0"');
  });

  it('rejects unknown content in a 1.0 file', () => {
    [
      '<video/>',
      '<heading level="1" color="red">A</heading>',
      '<body-text><p x="1">a</p></body-text>',
    ].forEach((block) =>
      expect(readWorksheet(zipWith(sheet(block, '', '1.0'))).ok).toBe(false),
    );
    expect(
      readWorksheet(
        zipWith(sheet('', '<metadata><license>x</license></metadata>', '1.0')),
      ).ok,
    ).toBe(false);
  });

  it('compares versions numerically and writes them back as read', () => {
    const bytes = zipWith(sheet('<map/>', '', '1.10'));
    expect(decodeWorksheet(bytes).blocks[0].type).toBe(UNSUPPORTED_BLOCK);
    expect(savedXml(roundTrip(bytes))).toContain('version="1.10"');
  });

  it('flags newer files through their version', () => {
    expect(decodeWorksheet(zipWith(sheet(''))).retained.version).toEqual({
      major: 1,
      minor: 1,
    });
    expect(
      decodeWorksheet(zipWith(sheet('', '', '1.0'))).retained.version,
    ).toEqual({ major: 1, minor: 0 });
  });
});
