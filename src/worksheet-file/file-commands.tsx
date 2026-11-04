import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorksheet } from '../worksheet/context';
import { emptyMetadata } from '../worksheet/metadata';
import { hasUnsavedChanges } from '../worksheet/reducer';
import { encodeWorksheet, readWorksheet } from './codec';
import {
  fileFlow,
  initialFileState,
  isBusy,
  UNTITLED,
  type FileCommand,
  type FileEffect,
  type FileEvent,
} from './file-flow';
import type { FilePort, FileRef } from './port';

export const APP_NAME = 'TeachingPaper';

/** The window title: the file name, or Untitled before the first save, marked while there are Unsaved Changes. */
export const windowTitle = (fileName: string | null, unsaved: boolean) =>
  `${unsaved ? '• ' : ''}${fileName ?? UNTITLED} — ${APP_NAME}`;

export type MenuEvents = (handler: (id: string) => void) => () => void;

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const COMMANDS: Record<string, FileCommand> = {
  'file-new': 'new',
  'open-file': 'open',
  'file-save': 'save',
  'file-save-as': 'save-as',
};

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
 * runs the `fileFlow` state machine (performing its effects through the port), keeps the window
 * title in step, asks about Unsaved Changes before they would be lost and listens for menu events
 * and keyboard shortcuts.
 */
export function FileCommands({
  port,
  menuEvents,
  onFileChange,
}: {
  port: FilePort;
  menuEvents: MenuEvents;
  /** Told whenever the current Worksheet File changes (null: none yet). */
  onFileChange?: (file: FileRef | null) => void;
}) {
  const { state, dispatch } = useWorksheet();
  const [file, setFile] = useState<FileRef | null>(null);
  const latest = useRef({ state });
  useEffect(() => {
    latest.current = { state };
  });
  const flow = useRef(initialFileState);
  const answerClose = useRef<((allowed: boolean) => void) | null>(null);

  useEffect(() => onFileChange?.(file), [file, onFileChange]);

  const title = windowTitle(file?.name ?? null, hasUnsavedChanges(state));
  useEffect(() => port.setWindowTitle(title), [port, title]);

  const perform = useCallback(
    (effect: FileEffect, send: (event: FileEvent) => void) => {
      switch (effect.type) {
        case 'ask-to-save':
          return void port
            .askToSaveChanges(effect.name)
            .then((answer) => send({ type: 'answered', answer }));
        case 'show-save-dialog':
          return void port
            .showSaveDialog(effect.suggestedName)
            .then((target) => send({ type: 'location-chosen', target }));
        case 'show-open-dialog':
          return void port
            .showOpenDialog()
            .then((chosen) => send({ type: 'file-chosen', chosen }));
        case 'write': {
          const { metadata, blocks, retained } = latest.current.state;
          return void Promise.resolve()
            .then(() =>
              port.writeBytes(
                effect.target,
                encodeWorksheet({
                  metadata,
                  blocks: blocks.map(({ type, data }) => ({ type, data })),
                  retained,
                }),
              ),
            )
            .then(
              () => {
                // Edits made while writing stay Unsaved Changes: only the written content counts as saved.
                dispatch({ type: 'saved', content: { metadata, blocks } });
                send({ type: 'written' });
              },
              (error) =>
                send({ type: 'write-failed', reason: reasonOf(error) }),
            );
        }
        case 'read':
          return void port.readBytes(effect.file).then(
            (bytes) => {
              const result = readWorksheet(bytes);
              send(
                result.ok
                  ? { type: 'read', worksheet: result.worksheet }
                  : { type: 'read-failed', reason: result.reason },
              );
            },
            (error) => send({ type: 'read-failed', reason: reasonOf(error) }),
          );
        case 'replace-worksheet':
          return dispatch({
            type: 'replace',
            ...(effect.worksheet ?? { metadata: emptyMetadata, blocks: [] }),
          });
        case 'show-error':
          return void port
            .showError(effect.title, effect.message)
            .catch((error) => console.error(error));
        case 'allow-close':
          return answerClose.current?.(effect.allowed);
      }
    },
    [port, dispatch],
  );

  // Effects report back through the latest `send`, which cannot refer to itself.
  const sendLater = useRef<(event: FileEvent) => void>(() => {});
  const send = useCallback(
    (event: FileEvent) => {
      const next = fileFlow(flow.current, event);
      flow.current = next.state;
      setFile(next.state.file);
      next.effects.forEach((effect) =>
        perform(effect, (reply) => sendLater.current(reply)),
      );
    },
    [perform],
  );
  useEffect(() => {
    sendLater.current = send;
  }, [send]);

  const run = useCallback(
    (id: string) => {
      const command = COMMANDS[id];
      if (command)
        send({
          type: 'command',
          command,
          unsaved: hasUnsavedChanges(latest.current.state),
        });
    },
    [send],
  );

  useEffect(() => menuEvents(run), [menuEvents, run]);

  useEffect(
    () =>
      port.onCloseRequested({
        hasUnsavedChanges: () => hasUnsavedChanges(latest.current.state),
        // Another command is under way: it has the dialogs, so the window stays open.
        mayClose: () =>
          isBusy(flow.current)
            ? Promise.resolve(false)
            : new Promise<boolean>((resolve) => {
                answerClose.current = resolve;
                send({
                  type: 'command',
                  command: 'close',
                  unsaved: hasUnsavedChanges(latest.current.state),
                });
              }),
      }),
    [port, send],
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
