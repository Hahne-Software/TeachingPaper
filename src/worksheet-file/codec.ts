import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const MEDIA_TYPE = 'application/vnd.teachingpaper.worksheet+zip';
const NAMESPACE = 'https://hahne.software/ns/teachingpaper/worksheet';
const FORMAT_VERSION = '1.0';

/** A Block as stored in a Worksheet File: without the editor's session id. */
export type StoredBlock = { type: string; data: unknown };

type HeadingData = { text: string; level: 1 | 2 | 3 };

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const blockToXml = ({ type, data }: StoredBlock): string[] => {
  switch (type) {
    case 'heading': {
      const { text, level } = data as HeadingData;
      return [`    <heading level="${level}">${escapeXml(text)}</heading>`];
    }
    // Other Block Types are not written yet.
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
