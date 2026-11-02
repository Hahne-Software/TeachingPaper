import type { FileRef } from '../worksheet-file/port';

/** What the Export asks of the host: where to put the file and how to turn HTML into a PDF. */
export type ExportPort = {
  /** Asks where to put the Export; null if cancelled. */
  showExportDialog: (
    suggestedName: string,
    format: { label: string; extension: string },
  ) => Promise<FileRef | null>;
  /** Prints the export document as an A4 PDF to the target. */
  printToPdf: (html: string, target: FileRef) => Promise<void>;
};
