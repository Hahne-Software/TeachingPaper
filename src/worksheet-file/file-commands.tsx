import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorksheet } from '../worksheet/context';
import { decodeWorksheet, encodeWorksheet } from './codec';
import type { FilePort, FileRef } from './port';

export const APP_NAME = 'TeachingPaper';
export const DEFAULT_FILE_NAME = 'Worksheet.tpsheet';

export type MenuEvents = (handler: (id: string) => void) => () => void;

const shortcutCommand = (event: KeyboardEvent) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  switch (event.key.toLowerCase()) {
    case 's':
      return event.shiftKey ? 'file-save-as' : 'file-save';
    case 'o':
      return event.shiftKey ? null : 'open-file';
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
  const latest = useRef({ blocks: state.blocks, file });
  useEffect(() => {
    latest.current = { blocks: state.blocks, file };
  });

  useEffect(() => {
    port.setWindowTitle(file ? `${file.name} — ${APP_NAME}` : APP_NAME);
  }, [port, file]);

  const writeTo = useCallback(
    async (target: FileRef) => {
      const { blocks } = latest.current;
      await port.writeBytes(
        target,
        encodeWorksheet(blocks.map(({ type, data }) => ({ type, data }))),
      );
      setFile(target);
    },
    [port],
  );

  const saveAs = useCallback(async () => {
    const target = await port.showSaveDialog(
      latest.current.file?.name ?? DEFAULT_FILE_NAME,
    );
    if (target) await writeTo(target);
  }, [port, writeTo]);

  const save = useCallback(async () => {
    const { file: current } = latest.current;
    if (current) await writeTo(current);
    else await saveAs();
  }, [saveAs, writeTo]);

  const open = useCallback(async () => {
    const chosen = await port.showOpenDialog();
    if (!chosen) return;
    const blocks = decodeWorksheet(await port.readBytes(chosen));
    dispatch({ type: 'replace', blocks });
    setFile(chosen);
  }, [port, dispatch]);

  const run = useCallback(
    (command: string) => {
      const action =
        command === 'file-save'
          ? save
          : command === 'file-save-as'
            ? saveAs
            : command === 'open-file'
              ? open
              : null;
      action?.().catch((error) => console.error(error));
    },
    [save, saveAs, open],
  );

  useEffect(() => menuEvents(run), [menuEvents, run]);

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
