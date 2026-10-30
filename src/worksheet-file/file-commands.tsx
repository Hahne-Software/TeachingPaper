import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorksheet } from '../worksheet/context';
import { emptyMetadata } from '../worksheet/metadata';
import { hasUnsavedChanges } from '../worksheet/reducer';
import { encodeWorksheet, readWorksheet } from './codec';
import type { FilePort, FileRef } from './port';

export const APP_NAME = 'TeachingPaper';
export const DEFAULT_FILE_NAME = 'Worksheet.tpsheet';
export const UNTITLED = 'Untitled';

/** The window title: the file name, or Untitled before the first save, marked while there are Unsaved Changes. */
export const windowTitle = (fileName: string | null, unsaved: boolean) =>
  `${unsaved ? '• ' : ''}${fileName ?? UNTITLED} — ${APP_NAME}`;

export type MenuEvents = (handler: (id: string) => void) => () => void;

const shortcutCommand = (event: KeyboardEvent) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  switch (event.key.toLowerCase()) {
    case 's':
      return event.shiftKey ? 'file-save-as' : 'file-save';
    case 'o':
      return event.shiftKey ? null : 'open-file';
    case 'n':
      return event.shiftKey ? null : 'file-new';
    default:
      return null;
  }
};

/**
 * New, Open, Save and Save As for the Worksheet in the surrounding provider. Renders nothing; it
 * remembers the current file, keeps the window title in step, asks about Unsaved Changes before
 * they would be lost and listens for menu events and keyboard shortcuts.
 */
export function FileCommands({
  port,
  menuEvents,
}: {
  port: FilePort;
  menuEvents: MenuEvents;
}) {
  const { state, dispatch } = useWorksheet();
  const [file, setFile] = useState<FileRef | null>(null);
  const latest = useRef({ state, file });
  useEffect(() => {
    latest.current = { state, file };
  });

  const title = windowTitle(file?.name ?? null, hasUnsavedChanges(state));
  useEffect(() => port.setWindowTitle(title), [port, title]);

  const fail = useCallback(
    (title: string, subject: string, error: unknown) =>
      port.showError(
        title,
        `${subject}. ${error instanceof Error ? error.message : String(error)}`,
      ),
    [port],
  );

  /**
   * Each resolves true when the Worksheet ended up in a file, false when a dialog was cancelled or
   * the write failed (which is reported and leaves the Worksheet unsaved).
   */
  const writeTo = useCallback(
    async (target: FileRef) => {
      const { metadata, blocks } = latest.current.state;
      try {
        await port.writeBytes(
          target,
          encodeWorksheet({
            metadata,
            blocks: blocks.map(({ type, data }) => ({ type, data })),
          }),
        );
      } catch (error) {
        await fail('Could not save', `Could not save ${target.name}`, error);
        return false;
      }
      // Edits made while writing stay Unsaved Changes: only the written content counts as saved.
      dispatch({ type: 'saved', content: { metadata, blocks } });
      setFile(target);
      return true;
    },
    [port, dispatch, fail],
  );

  const saveAs = useCallback(async () => {
    const target = await port.showSaveDialog(
      latest.current.file?.name ?? DEFAULT_FILE_NAME,
    );
    return target ? writeTo(target) : false;
  }, [port, writeTo]);

  const save = useCallback(async () => {
    const { file: current } = latest.current;
    return current ? writeTo(current) : saveAs();
  }, [saveAs, writeTo]);

  /** Resolves true when no Unsaved Changes are left to lose: none, saved, or discarded on purpose. */
  const settleChanges = useCallback(async () => {
    const { state: current, file: currentFile } = latest.current;
    if (!hasUnsavedChanges(current)) return true;
    const answer = await port.askToSaveChanges(currentFile?.name ?? UNTITLED);
    return answer === 'save' ? save() : answer === 'discard';
  }, [port, save]);

  const open = useCallback(async () => {
    if (!(await settleChanges())) return;
    const chosen = await port.showOpenDialog();
    if (!chosen) return;
    const subject = `Could not open ${chosen.name}`;
    let bytes: Uint8Array;
    try {
      bytes = await port.readBytes(chosen);
    } catch (error) {
      return fail('Could not open', subject, error);
    }
    const result = readWorksheet(bytes);
    if (!result.ok) return fail('Could not open', subject, result.reason);
    dispatch({ type: 'replace', ...result.worksheet });
    setFile(chosen);
  }, [port, dispatch, settleChanges, fail]);

  const startNew = useCallback(async () => {
    if (!(await settleChanges())) return;
    dispatch({ type: 'replace', metadata: emptyMetadata, blocks: [] });
    setFile(null);
  }, [dispatch, settleChanges]);

  const run = useCallback(
    (command: string) => {
      const commands: Record<string, () => Promise<unknown>> = {
        'file-new': startNew,
        'open-file': open,
        'file-save': save,
        'file-save-as': saveAs,
      };
      commands[command]?.().catch((error) => console.error(error));
    },
    [save, saveAs, open, startNew],
  );

  useEffect(() => menuEvents(run), [menuEvents, run]);

  useEffect(
    () =>
      port.onCloseRequested({
        hasUnsavedChanges: () => hasUnsavedChanges(latest.current.state),
        mayClose: settleChanges,
      }),
    [port, settleChanges],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = shortcutCommand(event);
      if (!command) return;
      event.preventDefault();
      run(command);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run]);

  return null;
}
