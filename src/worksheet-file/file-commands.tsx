import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorksheet } from '../worksheet/context';
import { emptyMetadata } from '../worksheet/metadata';
import { hasUnsavedChanges } from '../worksheet/reducer';
import { decodeWorksheet, encodeWorksheet } from './codec';
import type { FilePort, FileRef } from './port';

export const APP_NAME = 'TeachingPaper';
export const DEFAULT_FILE_NAME = 'Worksheet.tpsheet';
export const UNTITLED = 'Untitled';
const UNSAVED_MARKER = '• ';

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
 * Save, Save As and Open for the Worksheet in the surrounding provider. Renders nothing; it
 * remembers the current file, keeps the window title in step and listens for menu events and
 * keyboard shortcuts.
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

  const changed = hasUnsavedChanges(state);
  useEffect(() => {
    const marker = changed ? UNSAVED_MARKER : '';
    port.setWindowTitle(`${marker}${file?.name ?? UNTITLED} — ${APP_NAME}`);
  }, [port, file, changed]);

  /** Each resolves true when the Worksheet ended up in a file, false when a dialog was cancelled. */
  const writeTo = useCallback(
    async (target: FileRef) => {
      const { metadata, blocks } = latest.current.state;
      await port.writeBytes(
        target,
        encodeWorksheet({
          metadata,
          blocks: blocks.map(({ type, data }) => ({ type, data })),
        }),
      );
      // Edits made while writing stay unsaved: only the written content counts as saved.
      dispatch({ type: 'saved', content: { metadata, blocks } });
      setFile(target);
      return true;
    },
    [port, dispatch],
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

  /** Resolves true when nothing unsaved is left to lose: none, saved, or discarded on purpose. */
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
    const worksheet = decodeWorksheet(await port.readBytes(chosen));
    dispatch({ type: 'replace', ...worksheet });
    setFile(chosen);
  }, [port, dispatch, settleChanges]);

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
