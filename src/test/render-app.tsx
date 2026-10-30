import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { createFakePort } from '../worksheet-file/fake-port';
import type { MenuEvents } from '../worksheet-file/file-commands';

/** Renders the App against the fake FilePort, with a stand-in for the native menu. */
export function renderApp() {
  const { port, fake } = createFakePort();
  const handlers = new Set<(id: string) => void>();
  const menuEvents: MenuEvents = (handler) => {
    handlers.add(handler);
    return () => void handlers.delete(handler);
  };
  render(<App filePort={port} menuEvents={menuEvents} />);
  return {
    fake,
    /** Fires a native menu item by id, e.g. `file-save`. */
    menu: (id: string) => act(async () => handlers.forEach((h) => h(id))),
    /** Presses Ctrl plus `key`; `modifiers` adds more, e.g. `{Shift>}`. */
    key: (key: string, modifiers = '') =>
      userEvent.keyboard(`{Control>}${modifiers}${key}{/Control}`),
  };
}
