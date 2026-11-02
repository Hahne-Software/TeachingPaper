import { useCallback, useEffect } from 'react';
import { useWorksheet } from '../worksheet/context';
import type { WorksheetMetadata } from '../worksheet/metadata';
import type { MenuEvents } from '../worksheet-file/file-commands';
import { buildExportDocument } from './document';
import { exportFormats, type ExportFormat } from './formats';
import type { ExportPort } from './port';
import type { FilePort } from '../worksheet-file/port';

const DEFAULT_NAME = 'Worksheet';
const WORKSHEET_FILE_EXTENSION = /\.tpsheet$/i;
/** Characters most file systems refuse in a name. */
const UNSAFE_IN_NAME = /[\\/:*?"<>|]/g;

/** The Menu event id of an Export Format's File menu item. */
export const exportMenuId = (format: ExportFormat) =>
  `file-export-${format.id}`;

/** Worksheet File name, else Title, else `Worksheet`, with the Export Format's extension. */
export const suggestedExportName = (
  fileName: string | null,
  metadata: WorksheetMetadata,
  format: ExportFormat,
) => {
  const base =
    fileName?.replace(WORKSHEET_FILE_EXTENSION, '') ||
    metadata.title.replace(UNSAFE_IN_NAME, '-').trim() ||
    DEFAULT_NAME;
  return `${base}.${format.extension}`;
};

const SHORTCUT_FORMAT = 'pdf';

/**
 * The Export of the Worksheet in the surrounding provider, for every Export Format in the registry.
 * Renders nothing. It never changes the Worksheet or its Unsaved Changes.
 */
export function ExportCommands({
  port,
  filePort,
  fileName,
  menuEvents,
}: {
  port: ExportPort;
  /** Only used to report failures. */
  filePort: FilePort;
  /** The name of the open Worksheet File, null before the first save. */
  fileName: string | null;
  menuEvents: MenuEvents;
}) {
  const { state, getPageLayout } = useWorksheet();

  const exportAs = useCallback(
    async (format: ExportFormat) => {
      const target = await port.showExportDialog(
        suggestedExportName(fileName, state.metadata, format),
        format,
      );
      if (!target) return;
      try {
        const document = buildExportDocument({
          metadata: state.metadata,
          blocks: state.blocks,
          layout: getPageLayout(),
        });
        await format.write(document, target, port);
      } catch (error) {
        await filePort.showError(
          'Could not export',
          `Could not export ${target.name}. ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [port, filePort, fileName, state.metadata, state.blocks, getPageLayout],
  );

  useEffect(
    () =>
      menuEvents((id) => {
        const format = exportFormats.find((f) => exportMenuId(f) === id);
        if (format) exportAs(format).catch((error) => console.error(error));
      }),
    [menuEvents, exportAs],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
        return;
      if (event.key.toLowerCase() !== 'e') return;
      const format = exportFormats.find((f) => f.id === SHORTCUT_FORMAT);
      if (!format) return;
      event.preventDefault();
      exportAs(format).catch((error) => console.error(error));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exportAs]);

  return null;
}
