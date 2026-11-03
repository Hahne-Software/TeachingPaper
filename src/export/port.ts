import type { FileRef } from '../worksheet-file/port';

/** What will not print as the teacher sees it in the editor. */
export type ExportProblems = {
  /** Oversized Blocks, cut off where the editor cuts them. */
  cutOff: number;
  /** Unsupported Blocks, which print empty. */
  unsupported: number;
};

/** The notice text for a set of problems, one line per kind. */
export const describeExportProblems = ({
  cutOff,
  unsupported,
}: ExportProblems) =>
  [
    cutOff > 0 &&
      `${cutOff} ${cutOff === 1 ? 'Block' : 'Blocks'} taller than a Page will be cut off.`,
    unsupported > 0 &&
      `${unsupported} Unsupported ${unsupported === 1 ? 'Block' : 'Blocks'} will print empty.`,
  ]
    .filter(Boolean)
    .join('\n');

/** What the Export asks of the host: where to put the file and how to turn HTML into a PDF. */
export type ExportPort = {
  /** Shows the pre-export notice; true for "Export anyway", false for "Cancel". */
  confirmExportProblems: (problems: ExportProblems) => Promise<boolean>;
  /** Asks where to put the Export; null if cancelled. */
  showExportDialog: (
    suggestedName: string,
    format: { label: string; extension: string },
  ) => Promise<FileRef | null>;
  /** Prints the export document as an A4 PDF to the target. */
  printToPdf: (html: string, target: FileRef) => Promise<void>;
};
