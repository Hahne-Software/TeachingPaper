import type { FileRef } from '../worksheet-file/port';
import type { ExportDocument } from './document';
import type { ExportPort } from './port';

/** An Export Format is a small adapter: where the file goes and how the export document becomes it. */
export type ExportFormat = {
  id: 'pdf' | 'html';
  label: string;
  extension: string;
  write: (
    document: ExportDocument,
    target: FileRef,
    port: ExportPort,
  ) => Promise<void>;
};

const pdf: ExportFormat = {
  id: 'pdf',
  label: 'PDF',
  extension: 'pdf',
  write: ({ html }, target, port) => port.printToPdf(html, target),
};

/** Every Export Format the app offers; a further one needs only an adapter here and a menu entry. */
export const exportFormats: ExportFormat[] = [pdf];
