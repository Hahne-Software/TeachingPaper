// @vitest-environment jsdom
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { validateXML } from 'xmllint-wasm';
import schema from '../../docs/format/worksheet-1.0.xsd?raw';
import emptyExample from '../../docs/format/examples/valid/empty.xml?raw';
import ancientRome from '../../docs/format/examples/valid/ancient-rome.xml?raw';
import emptyBodyText from '../../docs/format/examples/invalid/empty-body-text.xml?raw';
import unknownInline from '../../docs/format/examples/invalid/unknown-inline-element.xml?raw';
import { MEDIA_TYPE, decodeWorksheet, encodeWorksheet } from './codec';

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

    expect(decodeWorksheet(encodeWorksheet(blocks))).toEqual(blocks);
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

    expect(decodeWorksheet(encodeWorksheet(blocks))).toEqual(blocks);
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

    expect(decodeWorksheet(encodeWorksheet(blocks))).toEqual(blocks);
  });

  it.each([
    ['line feed', '<p>one\ntwo</p>'],
    ['carriage return', '<p>one&#13;two</p>'],
    ['tab', '<p><b>one\ttwo</b></p>'],
  ])('rejects a raw %s in Body Text', (_, paragraph) => {
    expect(() =>
      decodeWorksheet(withBlocks(`<body-text>${paragraph}</body-text>`)),
    ).toThrow();
  });

  it('writes tabs as spaces and carriage returns as line breaks', () => {
    const pasted = bodyText([run('a\tb\r\nc\rd', { bold: true })]);

    expect(decodeWorksheet(encodeWorksheet([pasted]))).toEqual([
      bodyText([run('a b\nc\nd', { bold: true })]),
    ]);
  });

  it('leaves out characters XML cannot hold', () => {
    const blocks = [
      { type: 'heading', data: { text: 'a\u0000b\u000bc\ud800', level: 1 } },
      bodyText([run('d\u0007e\u000cf\uffff')]),
    ];

    expect(decodeWorksheet(encodeWorksheet(blocks))).toEqual([
      { type: 'heading', data: { text: 'abc', level: 1 } },
      bodyText([run('def')]),
    ]);
  });

  it('keeps the order of mixed Headings and Body Texts', () => {
    expect(decodeWorksheet(encodeWorksheet(mixed))).toEqual(mixed);
  });

  it('writes Body Text in the canonical form of the spec', () => {
    expect(worksheetXml(encodeWorksheet([specExample]))).toContain(
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

    expect(worksheetXml(encodeWorksheet([split]))).toBe(
      worksheetXml(encodeWorksheet([specExample])),
    );
  });

  it('reads b, i and u in any nesting order and redundant nesting', () => {
    const bytes = withBlocks(
      '<body-text><p><u><i><b>all</b></i></u> <i>it<i>al<b>ic</b></i></i><b><br/></b></p></body-text>',
    );

    expect(decodeWorksheet(bytes)).toEqual([
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

    expect(decodeWorksheet(bytes)).toEqual([
      bodyText([run('a <b>not bold</b>')]),
    ]);
  });

  it.each(validExamples)('opens valid/$name, zipped', ({ contents }) => {
    expect(() => decodeWorksheet(zipXml(contents))).not.toThrow();
  });

  it('opens the Ancient Rome example with its Body Text', () => {
    expect(decodeWorksheet(zipXml(ancientRome))).toEqual([
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
    expect(() => decodeWorksheet(zipXml(contents))).toThrow();
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
    expect(() => decodeWorksheet(withBlocks(blockXml))).toThrow();
  });

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
    const xml = worksheetXml(encodeWorksheet(mixed));

    const result = await validateXML({
      xml: { fileName: 'worksheet.xml', contents: xml },
      schema: { fileName: 'worksheet-1.0.xsd', contents: schema },
    });

    expect(result.errors).toEqual([]);
  });

  it('opens the valid empty example, zipped, as an empty Worksheet', () => {
    expect(decodeWorksheet(zipXml(emptyExample))).toEqual([]);
  });

  it('rejects files that are not Worksheet Files', () => {
    expect(() => decodeWorksheet(strToU8('not a zip'))).toThrow();
    expect(() =>
      decodeWorksheet(zipSync({ mimetype: strToU8('text/plain') })),
    ).toThrow();
  });
});
