import type { CloseGuard, FilePort, FileRef, SaveChangesAnswer } from './port';

/** In-memory FilePort for tests: queue dialog answers, then inspect what was asked and written. */
export const createFakePort = () => {
  const files = new Map<string, Uint8Array>();
  const nextOpen: (string | null)[] = [];
  const nextSave: (string | null)[] = [];
  const nextAnswer: SaveChangesAnswer[] = [];
  const guards = new Set<CloseGuard>();
  const fake = {
    /** File names the save-changes question was asked about. */
    questions: [] as string[],
    files,
    titles: [] as string[],
    openDialogs: 0,
    saveDialogs: 0,
    writes: [] as string[],
    /** The next open dialog picks this file name (null cancels). */
    answerOpen: (name: string | null) => void nextOpen.push(name),
    /** The next save dialog picks this file name (null cancels). */
    answerSave: (name: string | null) => void nextSave.push(name),
    /** The next save-changes question gets this answer (default: cancel). */
    answerQuestion: (answer: SaveChangesAnswer) => void nextAnswer.push(answer),
    /** Asks to close the window like the desktop app does; resolves whether it would close. */
    requestClose: async () => {
      for (const guard of guards)
        if (guard.hasUnsavedChanges() && !(await guard.mayClose()))
          return false;
      return true;
    },
  };
  const port: FilePort = {
    showOpenDialog: async () => {
      fake.openDialogs++;
      const name = nextOpen.shift() ?? null;
      return name === null ? null : { name };
    },
    showSaveDialog: async () => {
      fake.saveDialogs++;
      const name = nextSave.shift() ?? null;
      return name === null ? null : { name };
    },
    readBytes: async ({ name }: FileRef) => {
      const bytes = files.get(name);
      if (!bytes) throw new Error(`no such file: ${name}`);
      return bytes;
    },
    writeBytes: async ({ name }: FileRef, bytes) => {
      files.set(name, bytes);
      fake.writes.push(name);
    },
    askToSaveChanges: async (name) => {
      fake.questions.push(name);
      return nextAnswer.shift() ?? 'cancel';
    },
    onCloseRequested: (guard) => {
      guards.add(guard);
      return () => void guards.delete(guard);
    },
    setWindowTitle: (title) => void fake.titles.push(title),
  };
  return { port, fake };
};
