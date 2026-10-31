/** A file chosen through a dialog. Implementations may carry more data behind it. */
export type FileRef = { readonly name: string };

/** What to do with Unsaved Changes before they would be lost. */
export type SaveChangesAnswer = 'save' | 'discard' | 'cancel';

/** Asked when the window is about to close. */
export type CloseGuard = {
  /** Answered synchronously, for hosts that cannot wait for a question (a browser tab). */
  hasUnsavedChanges: () => boolean;
  /** Settles the Unsaved Changes; the window closes only if this resolves true. */
  mayClose: () => Promise<boolean>;
};

/** Everything the app needs from the file system and the window; injected so tests need no real one. */
export type FilePort = {
  /** Asks which Worksheet File to open; null if cancelled. */
  showOpenDialog: () => Promise<FileRef | null>;
  /** Asks where to save; null if cancelled. */
  showSaveDialog: (suggestedName: string) => Promise<FileRef | null>;
  readBytes: (file: FileRef) => Promise<Uint8Array>;
  writeBytes: (file: FileRef, bytes: Uint8Array) => Promise<void>;
  /** Asks Save / Don't Save / Cancel about the Unsaved Changes to the named Worksheet. */
  askToSaveChanges: (name: string) => Promise<SaveChangesAnswer>;
  /** Guards closing the window; returns a function that removes the guard. */
  onCloseRequested: (guard: CloseGuard) => () => void;
  /** Tells the teacher that something failed. */
  showError: (title: string, message: string) => Promise<void>;
  setWindowTitle: (title: string) => void;
};
