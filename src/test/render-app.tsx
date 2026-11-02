import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { createFakeExportPort } from '../export/fake-port';
import { createFakePort } from '../worksheet-file/fake-port';
import type { MenuEvents } from '../worksheet-file/file-commands';

/** Renders the App against the fake FilePort and ExportPort, with a stand-in for the native menu. */
export function renderApp() {
  const { port, fake } = createFakePort();
  const { port: exportPort, fake: exportFake } = createFakeExportPort();
  const handlers = new Set<(id: string) => void>();
  const menuEvents: MenuEvents = (handler) => {
    handlers.add(handler);
    return () => void handlers.delete(handler);
  };
  render(
    <App filePort={port} exportPort={exportPort} menuEvents={menuEvents} />,
  );
  return {
    fake,
    exportFake,
    /** Fires a native menu item by id, e.g. `file-save`. */
    menu: (id: string) => act(async () => handlers.forEach((h) => h(id))),
    /** Presses Ctrl plus `key`; `modifiers` adds more, e.g. `{Shift>}`. */
    key: (key: string, modifiers = '') =>
      userEvent.keyboard(`{Control>}${modifiers}${key}{/Control}`),
  };
}
