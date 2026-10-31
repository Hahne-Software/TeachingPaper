import {
  normalizeRuns,
  type BodyTextData,
  type Mark,
  type TextRun,
} from '../blocks/body-text-format';
import {
  emptyMetadata,
  metadataFields,
  type WorksheetMetadata,
} from '../worksheet/metadata';
import { singleLine } from '../worksheet/single-line';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MEDIA_TYPE = 'application/vnd.teachingpaper.worksheet+zip';
const NAMESPACE = 'https://hahne.software/ns/teachingpaper/worksheet';
const FORMAT_VERSION = '1.0';

/** A Block as stored in a Worksheet File: without the editor's session id. */
export type StoredBlock = { type: string; data: unknown };

/** A Worksheet as stored in a Worksheet File. */
export type StoredWorksheet = {
  metadata: WorksheetMetadata;
  blocks: StoredBlock[];
};

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

/**
 * Body Text must not contain raw tabs or carriage returns (e.g. from pasted text). Cleaned before
 * the runs are merged, so a run left empty writes no empty formatting element.
 */
const storableRun = (run: TextRun): TextRun => ({
  ...run,
  text: run.text
    .replace(notXmlCharacters, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' '),
});

const paragraphToXml = (runs: TextRun[]) => {
  const inner = runsToXml(normalizeRuns(runs.map(storableRun)));
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

/** Empty fields are left out, and so is `metadata` when every field is empty. */
const metadataToXml = (metadata: WorksheetMetadata): string[] => {
  const fields = metadataFields.flatMap(({ field, element }) => {
    const text = escapeXml(singleLine(metadata[field]));
    return text === '' ? [] : [`    <${element}>${text}</${element}>`];
  });
  return fields.length === 0
    ? []
    : ['  <metadata>', ...fields, '  </metadata>'];
};

const worksheetToXml = ({ metadata, blocks }: StoredWorksheet) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<worksheet xmlns="${NAMESPACE}" version="${FORMAT_VERSION}">`,
    ...metadataToXml(metadata),
    '  <blocks>',
    ...blocks.flatMap(blockToXml),
    '  </blocks>',
    '</worksheet>',
    '',
  ].join('\n');

/** Packs a Worksheet into the bytes of a Worksheet File. */
export const encodeWorksheet = (worksheet: StoredWorksheet): Uint8Array =>
  zipSync({
    mimetype: [strToU8(MEDIA_TYPE), { level: 0 }],
    'worksheet.xml': strToU8(worksheetToXml(worksheet)),
  });

/** A Worksheet File that must be rejected as a whole; `message` is meant for the teacher. */
export class WorksheetFileError extends Error {}

const reject = (reason: string): never => {
  throw new WorksheetFileError(reason);
};

const unzip = (bytes: Uint8Array) => {
  try {
    return unzipSync(bytes);
  } catch {
    return reject('It is not a Worksheet File (not a ZIP archive).');
  }
};

const parseXml = (xml: string) => {
  if (/<!DOCTYPE/i.test(xml))
    reject('It contains a document type declaration, which is not allowed.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0)
    reject('Its worksheet.xml is not well-formed XML.');
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
      if (/[\n\r\t]/.test(text))
        reject('Body Text contains a raw line break or tab.');
      return [{ text, ...formatting }];
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return [];
    if (isElement(child, 'br')) {
      if (child.hasChildNodes())
        reject('A line break in Body Text has content.');
      return [{ text: '\n', ...formatting }];
    }
    const mark =
      (child as Element).namespaceURI === NAMESPACE
        ? inlineMarks[(child as Element).localName]
        : undefined;
    if (!mark) return reject('Body Text contains unsupported formatting.');
    return runsFromXml(child, { ...formatting, [mark]: true });
  });

/** Whitespace between the children of an element is insignificant; other text is not allowed. */
const childElements = (element: Element) => {
  Array.from(element.childNodes).forEach((child) => {
    if (
      child.nodeType === Node.TEXT_NODE &&
      /[^ \t\r\n]/.test(child.nodeValue ?? '')
    )
      reject(`There is stray text inside <${element.localName}>.`);
  });
  return Array.from(element.children);
};

const paragraphsFromXml = (element: Element): TextRun[][] => {
  const paragraphs = childElements(element).map((child) => {
    if (!isElement(child, 'p'))
      reject('Body Text may only contain paragraphs.');
    return normalizeRuns(runsFromXml(child, plain));
  });
  if (paragraphs.length === 0) reject('A Body Text has no paragraphs.');
  return paragraphs;
};

const blockFromXml = (element: Element): StoredBlock => {
  if (element.namespaceURI !== NAMESPACE)
    reject('It contains an element in a wrong namespace.');
  switch (element.localName) {
    case 'heading': {
      const level = Number(element.getAttribute('level'));
      if (![1, 2, 3].includes(level))
        reject('A Heading Level is out of range (1 to 3).');
      if (element.children.length > 0)
        reject('A Heading may only contain text.');
      const text = element.textContent ?? '';
      if (/[\n\r]/.test(text)) reject('A Heading contains a raw line break.');
      return {
        type: 'heading',
        data: { text, level },
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
      return reject(
        `It contains an unknown Block Type "${element.localName}".`,
      );
  }
};

const isNamed = (element: Element | undefined, name: string) =>
  element !== undefined && isElement(element, name);

/** The field an element of `metadata` holds; rejects anything Format Version 1.0 does not allow. */
const metadataFieldOf = (child: Element, siblings: Element[]) => {
  const definition = metadataFields.find(({ element }) =>
    isNamed(child, element),
  );
  if (!definition)
    return reject(
      `It contains unknown Worksheet Metadata <${child.localName}>.`,
    );
  const occurrences = siblings.filter((sibling) =>
    isNamed(sibling, definition.element),
  ).length;
  if (occurrences > 1)
    reject(`<${child.localName}> appears twice in Worksheet Metadata.`);
  if (child.children.length > 0)
    reject(`<${child.localName}> may only contain text.`);
  return definition.field;
};

/** Reads `metadata`, whose children may come in any order; an empty element counts as absent. */
const metadataFromXml = (element: Element): WorksheetMetadata => {
  const children = childElements(element);
  return children.reduce((metadata, child) => {
    const text = child.textContent ?? '';
    if (/[\r\n]/.test(text))
      reject('Worksheet Metadata contains a line break.');
    return { ...metadata, [metadataFieldOf(child, children)]: text };
  }, emptyMetadata);
};

/** The root holds an optional `metadata`, then `blocks`, and nothing else. */
const worksheetParts = (root: Element) => {
  const [first, second, ...rest] = childElements(root);
  if (isNamed(first, 'blocks') && second === undefined)
    return { metadata: null, blocks: first };
  if (
    isNamed(first, 'metadata') &&
    isNamed(second, 'blocks') &&
    rest.length === 0
  )
    return { metadata: first, blocks: second };
  return reject(
    'Its worksheet.xml must hold an optional <metadata> followed by <blocks>.',
  );
};

const checkVersion = (version: string | null) => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version ?? '');
  if (!match) reject('Its Format Version is missing or malformed.');
  else if (version !== FORMAT_VERSION)
    reject(
      `It uses Format Version ${version}, which needs a newer TeachingPaper.`,
    );
};

/** Reads the Worksheet out of the bytes of a Worksheet File; throws a WorksheetFileError if the file is invalid. */
export const decodeWorksheet = (bytes: Uint8Array): StoredWorksheet => {
  const entries = unzip(bytes);
  if (!entries.mimetype || strFromU8(entries.mimetype) !== MEDIA_TYPE)
    reject('It is not a Worksheet File (its mimetype is missing or wrong).');
  if (!entries['worksheet.xml']) reject('Its worksheet.xml is missing.');
  const root = parseXml(strFromU8(entries['worksheet.xml']));
  if (root.localName !== 'worksheet' || root.namespaceURI !== NAMESPACE)
    reject('Its worksheet.xml is not a worksheet document.');
  checkVersion(root.getAttribute('version'));
  const parts = worksheetParts(root);
  return {
    metadata: parts.metadata ? metadataFromXml(parts.metadata) : emptyMetadata,
    blocks: childElements(parts.blocks).map(blockFromXml),
  };
};

export type ReadResult =
  { ok: true; worksheet: StoredWorksheet } | { ok: false; reason: string };

/** Like `decodeWorksheet`, but reports a rejected file as a reason instead of throwing. */
export const readWorksheet = (bytes: Uint8Array): ReadResult => {
  try {
    return { ok: true, worksheet: decodeWorksheet(bytes) };
  } catch (error) {
    if (error instanceof WorksheetFileError)
      return { ok: false, reason: error.message };
    throw error;
  }
};
