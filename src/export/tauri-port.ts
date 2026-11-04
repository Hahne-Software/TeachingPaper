import { invoke } from '@tauri-apps/api/core';
import { confirm, save } from '@tauri-apps/plugin-dialog';
import type { FileRef } from '../worksheet-file/port';
import { describeExportProblems, type ExportPort } from './port';

type TauriFileRef = FileRef & { readonly path: string };

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

const withExtension = (path: string, extension: string) =>
  path.toLowerCase().endsWith(`.${extension}`) ? path : `${path}.${extension}`;

const confirmReplace = async (path: string) =>
  !(await invoke<boolean>('file_exists', { path })) ||
  confirm(`${baseName(path)} already exists. Do you want to replace it?`, {
    title: 'Confirm Export',
    kind: 'warning',
  });

/** ExportPort for the desktop app: native dialogs and the own `export_pdf` command. */
export const createTauriExportPort = (): ExportPort => ({
  confirmExportProblems: (problems) =>
    confirm(describeExportProblems(problems), {
      title: 'Export',
      kind: 'warning',
      okLabel: 'Export anyway',
      cancelLabel: 'Cancel',
    }),
  showExportDialog: async (suggestedName, format) => {
    const typed = await save({
      defaultPath: suggestedName,
      filters: [{ name: format.label, extensions: [format.extension] }],
    });
    if (!typed) return null;
    const path = withExtension(typed, format.extension);
    // The system dialog only checked the typed name; the file we write may be another one.
    if (path !== typed && !(await confirmReplace(path))) return null;
    return { name: baseName(path), path } satisfies TauriFileRef;
  },
  printToPdf: async (html, target) => {
    try {
      await invoke('export_pdf', { html, path: (target as TauriFileRef).path });
    } catch (error) {
      // Tauri rejects with the command's error string, not an Error.
      throw error instanceof Error ? error : new Error(String(error));
    }
  },
});
