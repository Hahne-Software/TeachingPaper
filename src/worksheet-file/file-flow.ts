import type { StoredWorksheet } from './codec';
import type { FileRef, SaveChangesAnswer } from './port';

export const DEFAULT_FILE_NAME = 'Worksheet.tpsheet';
export const UNTITLED = 'Untitled';

/** What a command does once the Unsaved Changes are settled. */
type Intent = 'new' | 'open' | 'close';

export type FileCommand = 'new' | 'open' | 'save' | 'save-as' | 'close';

/** Where a command is waiting; everything but `idle` is waiting for the outcome of an effect. */
type Step =
  | { name: 'idle' }
  | { name: 'asking'; intent: Intent }
  | { name: 'choosing-location'; then: Intent | null }
  | { name: 'writing'; target: FileRef; then: Intent | null }
  | { name: 'choosing-file' }
  | { name: 'reading'; chosen: FileRef };

export type FileState = {
  /** The Worksheet File the Worksheet is kept in; null before the first save. */
  file: FileRef | null;
  step: Step;
};

export const initialFileState: FileState = {
  file: null,
  step: { name: 'idle' },
};

/** A command is under way, so further ones are ignored until it ends. */
export const isBusy = ({ step }: FileState) => step.name !== 'idle';

export type FileEvent =
  | {
      type: 'command';
      command: FileCommand;
      /** Whether the Worksheet has Unsaved Changes right now. */
      unsaved: boolean;
    }
  | { type: 'answered'; answer: SaveChangesAnswer }
  /** The save dialog closed; null if cancelled. */
  | { type: 'location-chosen'; target: FileRef | null }
  /** The open dialog closed; null if cancelled. */
  | { type: 'file-chosen'; chosen: FileRef | null }
  | { type: 'written' }
  | { type: 'write-failed'; reason: string }
  | { type: 'read'; worksheet: StoredWorksheet }
  | { type: 'read-failed'; reason: string };

/** What the runner has to do; its outcome comes back as a `FileEvent`. */
export type FileEffect =
  | { type: 'ask-to-save'; name: string }
  | { type: 'show-save-dialog'; suggestedName: string }
  | { type: 'show-open-dialog' }
  | { type: 'write'; target: FileRef }
  | { type: 'read'; file: FileRef }
  /** Starts the Worksheet from a Worksheet File, or empty if there is none. */
  | { type: 'replace-worksheet'; worksheet: StoredWorksheet | null }
  | { type: 'show-error'; title: string; message: string }
  /** The answer to a close request: whether the window may close. */
  | { type: 'allow-close'; allowed: boolean };

export type FileStep = { state: FileState; effects: FileEffect[] };

const idle = (state: FileState, ...effects: FileEffect[]): FileStep => ({
  state: { ...state, step: { name: 'idle' } },
  effects,
});

const stayOpen: FileEffect = { type: 'allow-close', allowed: false };

/** The command could not run to its end; closing the window must stay refused. */
const abort = (state: FileState, intent: Intent | null): FileStep =>
  idle(state, ...(intent === 'close' ? [stayOpen] : []));

const proceed = (state: FileState, intent: Intent): FileStep => {
  switch (intent) {
    case 'new':
      return idle(
        { ...state, file: null },
        { type: 'replace-worksheet', worksheet: null },
      );
    case 'open':
      return {
        state: { ...state, step: { name: 'choosing-file' } },
        effects: [{ type: 'show-open-dialog' }],
      };
    case 'close':
      return idle(state, { type: 'allow-close', allowed: true });
  }
};

/** Writes to the current file, or asks where to save if there is none yet. */
const save = (state: FileState, then: Intent | null): FileStep =>
  state.file
    ? {
        state: {
          ...state,
          step: { name: 'writing', target: state.file, then },
        },
        effects: [{ type: 'write', target: state.file }],
      }
    : saveAs(state, then);

const saveAs = (state: FileState, then: Intent | null): FileStep => ({
  state: { ...state, step: { name: 'choosing-location', then } },
  effects: [
    {
      type: 'show-save-dialog',
      suggestedName: state.file?.name ?? DEFAULT_FILE_NAME,
    },
  ],
});

const settleChanges = (
  state: FileState,
  intent: Intent,
  unsaved: boolean,
): FileStep =>
  unsaved
    ? {
        state: { ...state, step: { name: 'asking', intent } },
        effects: [{ type: 'ask-to-save', name: state.file?.name ?? UNTITLED }],
      }
    : proceed(state, intent);

const failure = (
  title: string,
  subject: string,
  reason: string,
): FileEffect => ({
  type: 'show-error',
  title,
  message: `${subject}. ${reason}`,
});

/**
 * New, Open, Save, Save As and closing the window as one state machine: each command runs through
 * its steps (asking about Unsaved Changes, dialogs, reading, writing) and ends back at `idle`.
 * Pure: the dialogs and file access are effects for the runner to perform.
 */
export const fileFlow = (state: FileState, event: FileEvent): FileStep => {
  const { step } = state;
  const ignored: FileStep = { state, effects: [] };

  if (event.type === 'command') {
    if (step.name !== 'idle') return ignored;
    switch (event.command) {
      case 'save':
        return save(state, null);
      case 'save-as':
        return saveAs(state, null);
      default:
        return settleChanges(state, event.command, event.unsaved);
    }
  }

  switch (step.name) {
    case 'asking':
      if (event.type !== 'answered') return ignored;
      if (event.answer === 'save') return save(state, step.intent);
      return event.answer === 'discard'
        ? proceed(state, step.intent)
        : abort(state, step.intent);

    case 'choosing-location':
      if (event.type !== 'location-chosen') return ignored;
      return event.target
        ? {
            state: {
              ...state,
              step: { name: 'writing', target: event.target, then: step.then },
            },
            effects: [{ type: 'write', target: event.target }],
          }
        : abort(state, step.then);

    case 'writing':
      if (event.type === 'written') {
        const saved = { ...state, file: step.target };
        return step.then ? proceed(saved, step.then) : idle(saved);
      }
      if (event.type === 'write-failed') {
        const { effects, ...ended } = abort(state, step.then);
        return {
          ...ended,
          effects: [
            failure(
              'Could not save',
              `Could not save ${step.target.name}`,
              event.reason,
            ),
            ...effects,
          ],
        };
      }
      return ignored;

    case 'choosing-file':
      if (event.type !== 'file-chosen') return ignored;
      return event.chosen
        ? {
            state: {
              ...state,
              step: { name: 'reading', chosen: event.chosen },
            },
            effects: [{ type: 'read', file: event.chosen }],
          }
        : idle(state);

    case 'reading':
      if (event.type === 'read')
        return idle(
          { ...state, file: step.chosen },
          { type: 'replace-worksheet', worksheet: event.worksheet },
        );
      if (event.type === 'read-failed')
        return idle(
          state,
          failure(
            'Could not open',
            `Could not open ${step.chosen.name}`,
            event.reason,
          ),
        );
      return ignored;

    case 'idle':
      return ignored;
  }
};
