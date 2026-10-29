import {
  normalizeRuns,
  type BodyTextData,
  type Mark,
  type TextRun,
} from '../blocks/body-text-format';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MEDIA_TYPE = 'application/vnd.teachingpaper.worksheet+zip';
const NAMESPACE = 'https://hahne.software/ns/teachingpaper/worksheet';
const FORMAT_VERSION = '1.0';

/** A Block as stored in a Worksheet File: without the editor's session id. */
export type StoredBlock = { type: string; data: unknown };

type HeadingData = { text: string; level: 1 | 2 | 3 };

/** Control characters, unpaired surrogates and U+FFFE/U+FFFF, which XML 1.0 cannot hold. */
const notXmlCharacters =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

const escapeXml = (text: string) =>
  text
    .replace(notXmlCharacters, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Inline elements in canonical nesting order, outermost first. */
const inlineElements: [Mark, string][] = [
  ['bold', 'b'],
  ['italic', 'i'],
  ['underline', 'u'],
];

/** Splits runs into maximal groups of neighbours that agree on `mark`. */
const groupByMark = (runs: TextRun[], mark: Mark) =>
  runs.reduce<TextRun[][]>((groups, run) => {
    const last = groups[groups.length - 1];
    return last && last[0][mark] === run[mark]
      ? [...groups.slice(0, -1), [...last, run]]
      : [...groups, [run]];
  }, []);

/** Writes runs nested `b` › `i` › `u`, so neighbouring runs share their outer elements. */
const runsToXml = (runs: TextRun[], depth = 0): string => {
  if (depth === inlineElements.length)
    return runs
      .map((run) => escapeXml(run.text).replace(/\n/g, '<br/>'))
      .join('');
  const [mark, name] = inlineElements[depth];
  return groupByMark(runs, mark)
    .map((group) => {
      const inner = runsToXml(group, depth + 1);
      return group[0][mark] ? `<${name}>${inner}</${name}>` : inner;
    })
    .join('');
};

/** Body Text must not contain raw tabs or carriage returns (e.g. from pasted text). */
const withoutTabsAndReturns = (run: TextRun): TextRun => ({
  ...run,
  text: run.text.replace(/\r\n?/g, '\n').replace(/\t/g, ' '),
});

const paragraphToXml = (runs: TextRun[]) => {
  const inner = runsToXml(normalizeRuns(runs.map(withoutTabsAndReturns)));
  return inner === '' ? '      <p/>' : `      <p>${inner}</p>`;
};

const blockToXml = ({ type, data }: StoredBlock): string[] => {
  switch (type) {
    case 'heading': {
      const { text, level } = data as HeadingData;
      return [`    <heading level="${level}">${escapeXml(text)}</heading>`];
    }
    case 'body-text': {
      const { paragraphs } = data as BodyTextData;
      return [
        '    <body-text>',
        ...paragraphs.map(paragraphToXml),
        '    </body-text>',
      ];
    }
    default:
      return [];
  }
};

const worksheetToXml = (blocks: StoredBlock[]) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<worksheet xmlns="${NAMESPACE}" version="${FORMAT_VERSION}">`,
    '  <blocks>',
    ...blocks.flatMap(blockToXml),
    '  </blocks>',
    '</worksheet>',
    '',
  ].join('\n');

/** Packs a Worksheet into the bytes of a Worksheet File. */
export const encodeWorksheet = (blocks: StoredBlock[]): Uint8Array =>
  zipSync({
    mimetype: [strToU8(MEDIA_TYPE), { level: 0 }],
    'worksheet.xml': strToU8(worksheetToXml(blocks)),
  });

const reject = (reason: string): never => {
  throw new Error(`Not a valid Worksheet File: ${reason}`);
};

const unzip = (bytes: Uint8Array) => {
  try {
    return unzipSync(bytes);
  } catch {
    return reject('not a ZIP archive');
  }
};

const parseXml = (xml: string) => {
  if (/<!DOCTYPE/i.test(xml))
    reject('document type declarations are not allowed');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0)
    reject('worksheet.xml is not well-formed XML');
  return document.documentElement;
};

const inlineMarks = Object.fromEntries(
  inlineElements.map(([mark, name]) => [name, mark]),
);

const plain = { bold: false, italic: false, underline: false };

const isElement = (node: Node, name: string): node is Element =>
  node.nodeType === Node.ELEMENT_NODE &&
  (node as Element).namespaceURI === NAMESPACE &&
  (node as Element).localName === name;

/** Reads mixed content; a text has the formatting of every element enclosing it. */
const runsFromXml = (node: Node, formatting: typeof plain): TextRun[] =>
  Array.from(node.childNodes).flatMap((child): TextRun[] => {
    if (
      child.nodeType === Node.TEXT_NODE ||
      child.nodeType === Node.CDATA_SECTION_NODE
    ) {
      const text = child.nodeValue ?? '';
      if (/[\n\r\t]/.test(text)) reject('raw line break or tab in Body Text');
      return [{ text, ...formatting }];
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return [];
    if (isElement(child, 'br')) {
      if (child.hasChildNodes()) reject('line break with content');
      return [{ text: '\n', ...formatting }];
    }
    const mark =
      (child as Element).namespaceURI === NAMESPACE
        ? inlineMarks[(child as Element).localName]
        : undefined;
    if (!mark) return reject('unsupported formatting in Body Text');
    return runsFromXml(child, { ...formatting, [mark]: true });
  });

/** Whitespace between the children of an element is insignificant; other text is not allowed. */
const childElements = (element: Element) => {
  Array.from(element.childNodes).forEach((child) => {
    if (
      child.nodeType === Node.TEXT_NODE &&
      /[^ \t\r\n]/.test(child.nodeValue ?? '')
    )
      reject(`text inside <${element.localName}>`);
  });
  return Array.from(element.children);
};

const paragraphsFromXml = (element: Element): TextRun[][] => {
  const paragraphs = childElements(element).map((child) => {
    if (!isElement(child, 'p')) reject('Body Text may only contain paragraphs');
    return normalizeRuns(runsFromXml(child, plain));
  });
  if (paragraphs.length === 0) reject('Body Text without paragraphs');
  return paragraphs;
};

const blockFromXml = (element: Element): StoredBlock => {
  if (element.namespaceURI !== NAMESPACE)
    reject('element in a wrong namespace');
  switch (element.localName) {
    case 'heading': {
      const level = Number(element.getAttribute('level'));
      if (![1, 2, 3].includes(level)) reject('Heading Level out of range');
      return {
        type: 'heading',
        data: { text: element.textContent ?? '', level },
      };
    }
    case 'body-text':
      return {
        type: 'body-text',
        data: {
          paragraphs: paragraphsFromXml(element),
        },
      };
    default:
      return reject(`unsupported Block Type "${element.localName}"`);
  }
};

/** Reads the Worksheet out of the bytes of a Worksheet File; throws if the file is invalid. */
export const decodeWorksheet = (bytes: Uint8Array): StoredBlock[] => {
  const entries = unzip(bytes);
  if (!entries.mimetype || strFromU8(entries.mimetype) !== MEDIA_TYPE)
    reject('wrong or missing mimetype');
  if (!entries['worksheet.xml']) reject('worksheet.xml is missing');
  const root = parseXml(strFromU8(entries['worksheet.xml']));
  if (root.localName !== 'worksheet' || root.namespaceURI !== NAMESPACE)
    reject('root element is not a worksheet');
  if (root.getAttribute('version') !== FORMAT_VERSION)
    reject('unsupported Format Version');
  const blocks = Array.from(root.children).find(
    (child) => child.localName === 'blocks',
  );
  return Array.from(blocks?.children ?? [], blockFromXml);
};
