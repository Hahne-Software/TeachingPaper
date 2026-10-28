/** A file chosen through a dialog. Implementations may carry more data behind it. */
export type FileRef = { readonly name: string };

/** Everything the app needs from the file system and the window; injected so tests need no real one. */
export type FilePort = {
  /** Asks which Worksheet File to open; null if cancelled. */
  showOpenDialog: () => Promise<FileRef | null>;
  /** Asks where to save; null if cancelled. */
  showSaveDialog: (suggestedName: string) => Promise<FileRef | null>;
  readBytes: (file: FileRef) => Promise<Uint8Array>;
  writeBytes: (file: FileRef, bytes: Uint8Array) => Promise<void>;
  setWindowTitle: (title: string) => void;
};
