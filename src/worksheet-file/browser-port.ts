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

/** FilePort for a plain browser: a file picker for Open, a download for Save. */
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
    setWindowTitle: (title) => {
      document.title = title;
    },
  };
};
