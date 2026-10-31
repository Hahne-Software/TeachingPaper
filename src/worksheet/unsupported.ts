/** Block Type id of an Unsupported Block, which no Worksheet File names itself. */
export const UNSUPPORTED_BLOCK = 'unsupported';

/** The data of an Unsupported Block: its original XML, kept unchanged. */
export type UnsupportedData = {
  /** Element name, to tell the teacher what is missing. */
  name: string;
  xml: string;
};
