import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { BlockPalette } from './components/BlockPalette';
import { PropertiesPanel } from './components/PropertiesPanel';
import { WorksheetDnd } from './components/WorksheetDnd';
import { Worksheet } from './components/Worksheet';
import { WorksheetProvider } from './worksheet/context';
import { createBrowserPort } from './worksheet-file/browser-port';
import { createTauriPort } from './worksheet-file/tauri-port';
import { FileCommands, type MenuEvents } from './worksheet-file/file-commands';
import type { FilePort } from './worksheet-file/port';
import './fonts.css';
import './App.css';

/** Menu events of the native menu; outside Tauri there is none and this stays silent. */
const tauriMenuEvents: MenuEvents = (handler) => {
  const unlisten = listen<string>('menu-event', (event) =>
    handler(event.payload),
  ).catch(() => () => {});
  return () => {
    unlisten.then((fn) => fn());
  };
};

const defaultPort = isTauri() ? createTauriPort() : createBrowserPort();

function App({
  filePort = defaultPort,
  menuEvents = tauriMenuEvents,
}: {
  filePort?: FilePort;
  menuEvents?: MenuEvents;
}) {
  return (
    <WorksheetProvider>
      <FileCommands port={filePort} menuEvents={menuEvents} />
      <WorksheetDnd>
        <div className="editor">
          <BlockPalette />
          <Worksheet />
          <PropertiesPanel />
        </div>
      </WorksheetDnd>
    </WorksheetProvider>
  );
}

export default App;
