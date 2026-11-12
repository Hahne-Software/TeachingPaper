import type { FileRef } from '../worksheet-file/port';
import type { ExportPort, ExportProblems } from './port';

/** In-memory ExportPort for tests: queue dialog answers, then inspect what was asked and printed. */
export const createFakeExportPort = () => {
  const nextAnswer: (string | null)[] = [];
  const failures: string[] = [];
  const noticeAnswers: boolean[] = [];
  let held: Promise<void> | null = null;
  const fake = {
    /** Every save dialog that was shown, with the name it suggested. */
    dialogs: [] as { suggestedName: string; format: string }[],
    /** Every call to `printToPdf`. */
    printed: [] as { html: string; target: string }[],
    /** Every pre-export notice that was shown. */
    notices: [] as ExportProblems[],
    /** The next pre-export notice is answered with Export anyway (true) or Cancel (false). */
    answerNotice: (exportAnyway: boolean) =>
      void noticeAnswers.push(exportAnyway),
    /** The next save dialog picks this file name (null cancels). */
    answerDialog: (name: string | null) => void nextAnswer.push(name),
    /** Keeps the next save dialog open until the returned function is called. */
    holdDialog: () => {
      let release = () => {};
      held = new Promise((resolve) => (release = resolve));
      return release;
    },
    /** The next `printToPdf` fails with this message. */
    failNextPrint: (message: string) => void failures.push(message),
    /** The latest export document, parsed. */
    lastDocument: () => {
      const last = fake.printed[fake.printed.length - 1];
      if (!last) throw new Error('nothing was exported');
      return new DOMParser().parseFromString(last.html, 'text/html');
    },
  };
  const port: ExportPort = {
    confirmExportProblems: async (problems) => {
      fake.notices.push(problems);
      return noticeAnswers.shift() ?? false;
    },
    showExportDialog: async (suggestedName, format) => {
      fake.dialogs.push({ suggestedName, format: format.label });
      const open = held;
      held = null;
      if (open) await open;
      const name = nextAnswer.shift() ?? null;
      return name === null ? null : ({ name } satisfies FileRef);
    },
    printToPdf: async (html, target) => {
      const failure = failures.shift();
      if (failure !== undefined) throw new Error(failure);
      fake.printed.push({ html, target: target.name });
    },
  };
  return { port, fake };
};
