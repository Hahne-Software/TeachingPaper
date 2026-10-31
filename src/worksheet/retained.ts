/** A Format Version: two integers, compared numerically, major first (`1.10` is newer than `1.9`). */
export type FormatVersion = { major: number; minor: number };

/** The Format Version this app reads natively and writes for new Worksheets. */
export const FORMAT_VERSION: FormatVersion = { major: 1, minor: 0 };

/** Reads `MAJOR.MINOR` without leading zeros; null if malformed. */
export const parseFormatVersion = (
  text: string | null,
): FormatVersion | null => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(text ?? '');
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null;
};

export const formatVersionText = ({ major, minor }: FormatVersion) =>
  `${major}.${minor}`;

/** Negative if `a` is older than `b`, positive if newer, 0 if equal. */
export const compareFormatVersions = (a: FormatVersion, b: FormatVersion) =>
  a.major - b.major || a.minor - b.minor;

/**
 * What a Worksheet File holds that the app does not edit but must write back unchanged: its Format
 * Version, unknown Worksheet Metadata elements (as XML) and archive entries other than `mimetype`
 * and `worksheet.xml`.
 */
export type Retained = {
  version: FormatVersion;
  unknownMetadata: string[];
  entries: Record<string, Uint8Array>;
};

export const noRetained: Retained = {
  version: FORMAT_VERSION,
  unknownMetadata: [],
  entries: {},
};

/** Whether the file comes from a newer MINOR Format Version than this app implements. */
export const isNewerVersion = ({ version }: Retained) =>
  compareFormatVersions(version, FORMAT_VERSION) > 0;
