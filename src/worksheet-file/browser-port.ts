import type { FilePort, FileRef } from './port';
import { MEDIA_TYPE } from './codec';

const pickFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tpsheet';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });

/** FilePort for a plain browser: a file picker for Open, a download for Save, `confirm` for questions. */
export const createBrowserPort = (): FilePort => {
  const picked = new WeakMap<FileRef, File>();
  return {
    showOpenDialog: async () => {
      const file = await pickFile();
      if (!file) return null;
      const ref = { name: file.name };
      picked.set(ref, file);
      return ref;
    },
    // A browser cannot ask for a location; the download takes the suggested name.
    showSaveDialog: async (suggestedName) => ({ name: suggestedName }),
    readBytes: async (ref) => {
      const file = picked.get(ref);
      if (!file) throw new Error(`${ref.name} was not picked from disk`);
      return new Uint8Array(await file.arrayBuffer());
    },
    writeBytes: async ({ name }, bytes) => {
      const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: MEDIA_TYPE }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    },
    // `confirm` has only two buttons, so the three answers take up to two questions.
    askToSaveChanges: async (name) =>
      window.confirm(
        `Do you want to save the changes to ${name}?\n\nOK saves them; Cancel lets you discard them.`,
      )
        ? 'save'
        : window.confirm(`Discard the changes to ${name}?`)
          ? 'discard'
          : 'cancel',
    // A closing tab cannot wait for an answer; the browser shows its own question instead.
    onCloseRequested: ({ hasUnsavedChanges }) => {
      const onBeforeUnload = (event: BeforeUnloadEvent) => {
        if (hasUnsavedChanges()) event.preventDefault();
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      return () => window.removeEventListener('beforeunload', onBeforeUnload);
    },
    showError: async (title, message) => window.alert(`${title}\n\n${message}`),
    setWindowTitle: (title) => {
      document.title = title;
    },
  };
};
