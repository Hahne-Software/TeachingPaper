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
import {
  FORMAT_VERSION,
  noRetained,
  type Retained,
} from '../worksheet/retained';
import { singleLine } from '../worksheet/single-line';
import {
  UNSUPPORTED_BLOCK,
  type UnsupportedData,
} from '../worksheet/unsupported';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MEDIA_TYPE = 'application/vnd.teachingpaper.worksheet+zip';
const NAMESPACE = 'https://hahne.software/ns/teachingpaper/worksheet';

/** A Block as stored in a Worksheet File: without the editor's session id. */
export type StoredBlock = { type: string; data: unknown };

/** A Worksheet as stored in a Worksheet File. */
export type StoredWorksheet = {
  metadata: WorksheetMetadata;
  blocks: StoredBlock[];
  /** Content kept from the file this Worksheet was read from; none for a new Worksheet. */
  retained?: Retained;
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
    case UNSUPPORTED_BLOCK:
      return [`    ${(data as UnsupportedData).xml}`];
    default:
      return [];
  }
};

/** Empty fields are left out, and so is `metadata` when every field is empty. */
const metadataToXml = (
  metadata: WorksheetMetadata,
  unknown: string[],
): string[] => {
  const fields = metadataFields.flatMap(({ field, element }) => {
    const text = escapeXml(singleLine(metadata[field]));
    return text === '' ? [] : [`    <${element}>${text}</${element}>`];
  });
  const all = [...fields, ...unknown.map((xml) => `    ${xml}`)];
  return all.length === 0 ? [] : ['  <metadata>', ...all, '  </metadata>'];
};

const worksheetToXml = (
  { metadata, blocks }: StoredWorksheet,
  { version, metadata: unknownMetadata }: Retained,
) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<worksheet xmlns="${NAMESPACE}" version="${version}">`,
    ...metadataToXml(metadata, unknownMetadata),
    '  <blocks>',
    ...blocks.flatMap(blockToXml),
    '  </blocks>',
    '</worksheet>',
    '',
  ].join('\n');

/** Packs a Worksheet into the bytes of a Worksheet File, with its retained content unchanged. */
export const encodeWorksheet = (worksheet: StoredWorksheet): Uint8Array => {
  const retained = worksheet.retained ?? noRetained;
  return zipSync({
    mimetype: [strToU8(MEDIA_TYPE), { level: 0 }],
    'worksheet.xml': strToU8(worksheetToXml(worksheet, retained)),
    ...retained.entries,
  });
};

/** A Worksheet File that must be rejected as a whole; `message` is meant for the teacher. */
export class WorksheetFileError extends Error {}

const reject = (reason: string): never => {
  throw new WorksheetFileError(reason);
};

/**
 * Content that Format Version 1.0 does not define. A newer MINOR version may contain it, so it is
 * kept unchanged there; in a 1.0 file it is a rule violation.
 */
class UnknownContent extends WorksheetFileError {}

const unknown = (reason: string): never => {
  throw new UnknownContent(reason);
};

/** Rejects attributes, as none are defined on `element` beyond `allowed`. */
const noOtherAttributes = (element: Element, allowed: string[] = []) => {
  const extra = Array.from(element.attributes).find(
    (attribute) => !allowed.includes(attribute.name),
  );
  if (extra) unknown(`<${element.localName}> has an unknown attribute.`);
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
      noOtherAttributes(child);
      if (child.hasChildNodes())
        reject('A line break in Body Text has content.');
      return [{ text: '\n', ...formatting }];
    }
    const mark =
      (child as Element).namespaceURI === NAMESPACE
        ? inlineMarks[(child as Element).localName]
        : undefined;
    if (!mark) return unknown('Body Text contains unsupported formatting.');
    noOtherAttributes(child as Element);
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
      unknown('Body Text may only contain paragraphs.');
    noOtherAttributes(child);
    return normalizeRuns(runsFromXml(child, plain));
  });
  if (paragraphs.length === 0) reject('A Body Text has no paragraphs.');
  return paragraphs;
};

const blockFromXml = (element: Element): StoredBlock => {
  if (element.namespaceURI !== NAMESPACE)
    unknown('It contains an element in a wrong namespace.');
  switch (element.localName) {
    case 'heading': {
      noOtherAttributes(element, ['level']);
      const level = Number(element.getAttribute('level'));
      if (![1, 2, 3].includes(level))
        reject('A Heading Level is out of range (1 to 3).');
      if (element.children.length > 0)
        unknown('A Heading may only contain text.');
      const text = element.textContent ?? '';
      if (/[\n\r]/.test(text)) reject('A Heading contains a raw line break.');
      return {
        type: 'heading',
        data: { text, level },
      };
    }
    case 'body-text':
      noOtherAttributes(element);
      return {
        type: 'body-text',
        data: {
          paragraphs: paragraphsFromXml(element),
        },
      };
    default:
      return unknown(
        `It contains an unknown Block Type "${element.localName}".`,
      );
  }
};

/** The XML of `element` as it stands in a document whose default namespace is ours. */
const xmlOf = (element: Element) => {
  const xml = new XMLSerializer().serializeToString(element);
  // The serializer declares the default namespace again on a lone element; the text we write it into already has it.
  return xml.replace(/^(<[^\s/>]+) xmlns="([^"]*)"/, (all, tag, ns) =>
    ns === NAMESPACE ? tag : all,
  );
};

/** In a newer MINOR version, a Block with unknown content is kept as it is. */
const blockOrUnsupported = (element: Element, newer: boolean): StoredBlock => {
  try {
    return blockFromXml(element);
  } catch (error) {
    if (!newer || !(error instanceof UnknownContent)) throw error;
    const data: UnsupportedData = {
      name: element.localName,
      xml: xmlOf(element),
    };
    return { type: UNSUPPORTED_BLOCK, data };
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
    return unknown(
      `It contains unknown Worksheet Metadata <${child.localName}>.`,
    );
  noOtherAttributes(child);
  const occurrences = siblings.filter((sibling) =>
    isNamed(sibling, definition.element),
  ).length;
  if (occurrences > 1)
    reject(`<${child.localName}> appears twice in Worksheet Metadata.`);
  if (child.children.length > 0)
    unknown(`<${child.localName}> may only contain text.`);
  return definition.field;
};

/**
 * Reads `metadata`, whose children may come in any order; an empty element counts as absent. In a
 * newer MINOR version, children with unknown content are returned as XML to be kept.
 */
const metadataFromXml = (element: Element, newer: boolean) => {
  const children = childElements(element);
  return children.reduce(
    (read, child) => {
      try {
        const field = metadataFieldOf(child, children);
        const text = child.textContent ?? '';
        if (/[\r\n]/.test(text))
          reject('Worksheet Metadata contains a line break.');
        return { ...read, metadata: { ...read.metadata, [field]: text } };
      } catch (error) {
        if (!newer || !(error instanceof UnknownContent)) throw error;
        return { ...read, unknown: [...read.unknown, xmlOf(child)] };
      }
    },
    { metadata: emptyMetadata, unknown: [] as string[] },
  );
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

/** The file's Format Version; rejects another MAJOR version. */
const readVersion = (version: string | null) => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version ?? '');
  if (!match) return reject('Its Format Version is missing or malformed.');
  if (match[1] !== FORMAT_VERSION.split('.')[0])
    reject(
      `It uses Format Version ${version}, which needs a newer TeachingPaper.`,
    );
  return version as string;
};

/** Reads the Worksheet out of the bytes of a Worksheet File; throws a WorksheetFileError if the file is invalid. */
export const decodeWorksheet = (
  bytes: Uint8Array,
): Required<StoredWorksheet> => {
  const entries = unzip(bytes);
  if (!entries.mimetype || strFromU8(entries.mimetype) !== MEDIA_TYPE)
    reject('It is not a Worksheet File (its mimetype is missing or wrong).');
  if (!entries['worksheet.xml']) reject('Its worksheet.xml is missing.');
  const root = parseXml(strFromU8(entries['worksheet.xml']));
  if (root.localName !== 'worksheet' || root.namespaceURI !== NAMESPACE)
    reject('Its worksheet.xml is not a worksheet document.');
  const version = readVersion(root.getAttribute('version'));
  const newer = version !== FORMAT_VERSION;
  const parts = worksheetParts(root);
  const metadata = parts.metadata
    ? metadataFromXml(parts.metadata, newer)
    : { metadata: emptyMetadata, unknown: [] };
  const others = Object.fromEntries(
    Object.entries(entries).filter(
      ([name]) => name !== 'mimetype' && name !== 'worksheet.xml',
    ),
  );
  return {
    metadata: metadata.metadata,
    blocks: childElements(parts.blocks).map((block) =>
      blockOrUnsupported(block, newer),
    ),
    retained: { version, metadata: metadata.unknown, entries: others },
  };
};

export type ReadResult =
  | { ok: true; worksheet: Required<StoredWorksheet> }
  | { ok: false; reason: string };

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
