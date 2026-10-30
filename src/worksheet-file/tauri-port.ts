import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm, message, open, save } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import type { FilePort, FileRef, SaveChangesAnswer } from './port';

const EXTENSION = 'tpsheet';
const filters = [{ name: 'Worksheet', extensions: [EXTENSION] }];

type TauriFileRef = FileRef & { readonly path: string };

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

const withExtension = (path: string) =>
  path.toLowerCase().endsWith(`.${EXTENSION}`) ? path : `${path}.${EXTENSION}`;

const pathOf = (file: FileRef) => (file as TauriFileRef).path;

const confirmReplace = async (path: string) =>
  !(await invoke<boolean>('file_exists', { path })) ||
  confirm(`${baseName(path)} already exists. Do you want to replace it?`, {
    title: 'Confirm Save As',
    kind: 'warning',
  });

const refFor = (path: string): TauriFileRef => ({
  name: baseName(path),
  path,
});

const SAVE = 'Save';
const DONT_SAVE = "Don't Save";

// Custom buttons answer with their label; the default names are accepted as well.
const answerFor = (button: string): SaveChangesAnswer =>
  button === SAVE || button === 'Yes'
    ? 'save'
    : button === DONT_SAVE || button === 'No'
      ? 'discard'
      : 'cancel';

/** FilePort for the desktop app: native dialogs, plugin-fs for reading, an own atomic write command. */
export const createTauriPort = (): FilePort => ({
  showOpenDialog: async () => {
    const path = await open({ multiple: false, directory: false, filters });
    return path ? refFor(path) : null;
  },
  showSaveDialog: async (suggestedName) => {
    const typed = await save({ defaultPath: suggestedName, filters });
    if (!typed) return null;
    const path = withExtension(typed);
    // The system dialog only checked the typed name; the file we write may be another one.
    if (path !== typed && !(await confirmReplace(path))) return null;
    return refFor(path);
  },
  readBytes: (file) => readFile(pathOf(file)),
  writeBytes: (file, bytes) =>
    invoke('write_file_atomic', bytes, {
      headers: { path: encodeURIComponent(pathOf(file)) },
    }),
  askToSaveChanges: async (name) =>
    answerFor(
      await message(
        `Do you want to save the changes to ${name}? Your changes will be lost if you don't save them.`,
        {
          title: 'Unsaved Changes',
          kind: 'warning',
          buttons: { yes: SAVE, no: DONT_SAVE, cancel: 'Cancel' },
        },
      ),
    ),
  onCloseRequested: (guard) => {
    // Tauri destroys the window after the handler unless it prevented that.
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (guard.hasUnsavedChanges() && !(await guard.mayClose()))
        event.preventDefault();
    });
    return () => {
      unlisten.then((fn) => fn()).catch((error) => console.error(error));
    };
  },
  setWindowTitle: (title) => {
    getCurrentWindow()
      .setTitle(title)
      .catch((error) => console.error(error));
  },
});
