import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import type { FilePort, FileRef } from './port';

const EXTENSION = '.tpsheet';
const filters = [{ name: 'Worksheet', extensions: ['tpsheet'] }];

type TauriFileRef = FileRef & { readonly path: string };

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

const withExtension = (path: string) =>
  path.toLowerCase().endsWith(EXTENSION) ? path : path + EXTENSION;

const refFor = (path: string): TauriFileRef => ({
  name: baseName(path),
  path,
});

/** FilePort for the desktop app: native dialogs, plugin-fs for reading, an own atomic write command. */
export const createTauriPort = (): FilePort => ({
  showOpenDialog: async () => {
    const path = await open({ multiple: false, directory: false, filters });
    return path ? refFor(path) : null;
  },
  showSaveDialog: async (suggestedName) => {
    const path = await save({ defaultPath: suggestedName, filters });
    return path ? refFor(withExtension(path)) : null;
  },
  readBytes: (file) => readFile((file as TauriFileRef).path),
  writeBytes: (file, bytes) =>
    invoke('write_file_atomic', bytes, {
      headers: { path: encodeURIComponent((file as TauriFileRef).path) },
    }),
  setWindowTitle: (title) => {
    getCurrentWindow()
      .setTitle(title)
      .catch((error) => console.error(error));
  },
});
