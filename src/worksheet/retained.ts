/** The Format Version this app reads natively and writes for new Worksheets. */
export const FORMAT_VERSION = '1.0';

/**
 * What a Worksheet File holds that the app does not edit but must write back unchanged: its Format
 * Version, unknown Worksheet Metadata elements (as XML) and archive entries other than `mimetype`
 * and `worksheet.xml`.
 */
export type Retained = {
  version: string;
  metadata: string[];
  entries: Record<string, Uint8Array>;
};

export const noRetained: Retained = {
  version: FORMAT_VERSION,
  metadata: [],
  entries: {},
};

/** Whether the file comes from a newer MINOR Format Version than this app implements. */
export const isNewerVersion = ({ version }: Retained) =>
  version !== FORMAT_VERSION;
