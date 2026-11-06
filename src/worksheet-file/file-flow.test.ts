import { describe, expect, it } from 'vitest';
import type { StoredWorksheet } from './codec';
import {
  fileFlow,
  initialFileState,
  isBusy,
  type FileEvent,
  type FileState,
} from './file-flow';

const rome = { name: 'rome.tpsheet' };
const worksheet = { blocks: [] } as unknown as StoredWorksheet;

/** Feeds the events one after another; returns the final state and the effect types per event. */
const run = (events: FileEvent[], from: FileState = initialFileState) =>
  events.reduce(
    (acc, event) => {
      const { state, effects } = fileFlow(acc.state, event);
      return { state, effects, all: [...acc.all, ...effects] };
    },
    {
      state: from,
      effects: [] as ReturnType<typeof fileFlow>['effects'],
      all: [] as ReturnType<typeof fileFlow>['effects'],
    },
  );

const command = (
  command: Extract<FileEvent, { type: 'command' }>['command'],
  unsaved = false,
): FileEvent => ({ type: 'command', command, unsaved });

const last = <T>(items: T[]) => items[items.length - 1];

const saved: FileState = { ...initialFileState, file: rome };

describe('fileFlow', () => {
  describe('Save', () => {
    it('asks where to save before the first write, then remembers the file', () => {
      const { state, all } = run([
        command('save'),
        { type: 'location-chosen', target: rome },
        { type: 'written' },
      ]);

      expect(all).toEqual([
        { type: 'show-save-dialog', suggestedName: 'Worksheet.tpsheet' },
        { type: 'write', target: rome },
      ]);
      expect(state).toEqual(saved);
    });

    it('rewrites the current file without asking', () => {
      const { all } = run([command('save')], saved);
      expect(all).toEqual([{ type: 'write', target: rome }]);
    });

    it('stays unsaved and reports why when writing fails', () => {
      const { state, all } = run(
        [command('save'), { type: 'write-failed', reason: 'disk full' }],
        saved,
      );

      expect(last(all)).toEqual({
        type: 'show-error',
        title: 'Could not save',
        message: 'Could not save rome.tpsheet. disk full',
      });
      expect(state).toEqual(saved);
    });

    it('does not remember a file that could not be written', () => {
      const { state } = run([
        command('save'),
        { type: 'location-chosen', target: rome },
        { type: 'write-failed', reason: 'disk full' },
      ]);
      expect(state).toEqual(initialFileState);
    });

    it('does nothing when the save dialog is cancelled', () => {
      const { state, effects } = run([
        command('save'),
        { type: 'location-chosen', target: null },
      ]);
      expect(effects).toEqual([]);
      expect(state).toEqual(initialFileState);
    });
  });

  describe('Save As', () => {
    it('always asks, suggesting the current name, and switches to the new file', () => {
      const other = { name: 'other.tpsheet' };
      const { state, all } = run(
        [
          command('save-as'),
          { type: 'location-chosen', target: other },
          { type: 'written' },
        ],
        saved,
      );

      expect(all[0]).toEqual({
        type: 'show-save-dialog',
        suggestedName: 'rome.tpsheet',
      });
      expect(state.file).toEqual(other);
    });
  });

  describe.each(['new', 'open', 'close'] as const)('%s', (intent) => {
    const start = (unsaved: boolean) => run([command(intent, unsaved)], saved);

    it('asks about Unsaved Changes, naming the file', () => {
      expect(start(true).effects).toEqual([
        { type: 'ask-to-save', name: 'rome.tpsheet' },
      ]);
    });

    it('names an unsaved Worksheet Untitled', () => {
      expect(run([command(intent, true)]).effects).toEqual([
        { type: 'ask-to-save', name: 'Untitled' },
      ]);
    });

    it('does not ask when there is nothing to lose', () => {
      expect(start(false).effects).not.toContainEqual(
        expect.objectContaining({ type: 'ask-to-save' }),
      );
    });

    it('on Cancel keeps everything', () => {
      const { state, effects } = run(
        [command(intent, true), { type: 'answered', answer: 'cancel' }],
        saved,
      );
      expect(state).toEqual(saved);
      expect(effects).toEqual(
        intent === 'close' ? [{ type: 'allow-close', allowed: false }] : [],
      );
    });

    it('on Save writes first and carries on once written', () => {
      const { all, state } = run(
        [
          command(intent, true),
          { type: 'answered', answer: 'save' },
          { type: 'written' },
        ],
        saved,
      );
      expect(all[1]).toEqual({ type: 'write', target: rome });
      expect(state.step).not.toEqual({ name: 'writing' });
      expect(last(all)).toEqual(
        {
          new: { type: 'replace-worksheet', worksheet: null },
          open: { type: 'show-open-dialog' },
          close: { type: 'allow-close', allowed: true },
        }[intent],
      );
    });

    it('on Save goes no further when the save dialog is cancelled', () => {
      const { effects, state } = run([
        command(intent, true),
        { type: 'answered', answer: 'save' },
        { type: 'location-chosen', target: null },
      ]);
      expect(state).toEqual(initialFileState);
      expect(effects).toEqual(
        intent === 'close' ? [{ type: 'allow-close', allowed: false }] : [],
      );
    });

    it('on Save goes no further when writing fails', () => {
      const { all, state } = run(
        [
          command(intent, true),
          { type: 'answered', answer: 'save' },
          { type: 'write-failed', reason: 'disk full' },
        ],
        saved,
      );
      expect(state).toEqual(saved);
      expect(all.map((e) => e.type)).not.toContain('replace-worksheet');
      expect(all.map((e) => e.type)).not.toContain('show-open-dialog');
      expect(last(all)).toEqual(
        intent === 'close'
          ? { type: 'allow-close', allowed: false }
          : expect.objectContaining({ type: 'show-error' }),
      );
    });
  });

  describe('New', () => {
    it("starts an empty Untitled Worksheet on Don't Save", () => {
      const { state, effects } = run(
        [command('new', true), { type: 'answered', answer: 'discard' }],
        saved,
      );
      expect(effects).toEqual([{ type: 'replace-worksheet', worksheet: null }]);
      expect(state).toEqual(initialFileState);
    });
  });

  describe('Open', () => {
    it('reads the chosen file, then shows it and remembers it', () => {
      const { state, all } = run([
        command('open'),
        { type: 'file-chosen', chosen: rome },
        { type: 'read', worksheet },
      ]);
      expect(all).toEqual([
        { type: 'show-open-dialog' },
        { type: 'read', file: rome },
        { type: 'replace-worksheet', worksheet },
      ]);
      expect(state).toEqual(saved);
    });

    it('changes nothing when the open dialog is cancelled', () => {
      const { state, effects } = run(
        [command('open'), { type: 'file-chosen', chosen: null }],
        saved,
      );
      expect(effects).toEqual([]);
      expect(state).toEqual(saved);
    });

    it('reports a rejected file and keeps the current file', () => {
      const { state, effects } = run(
        [
          command('open'),
          { type: 'file-chosen', chosen: { name: 'notes.txt' } },
          { type: 'read-failed', reason: 'Not a ZIP archive.' },
        ],
        saved,
      );
      expect(effects).toEqual([
        {
          type: 'show-error',
          title: 'Could not open',
          message: 'Could not open notes.txt. Not a ZIP archive.',
        },
      ]);
      expect(state).toEqual(saved);
    });
  });

  describe('while a command is under way', () => {
    it('ignores further commands and stray events', () => {
      const busy = run([command('open')], saved).state;
      expect(isBusy(busy)).toBe(true);
      expect(isBusy(saved)).toBe(false);

      for (const event of [
        command('new', true),
        command('save'),
        { type: 'written' } as const,
      ])
        expect(fileFlow(busy, event)).toEqual({ state: busy, effects: [] });
    });
  });
});
