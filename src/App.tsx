import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useState } from 'react';
import { ExportCommands } from './export/export-commands';
import {
  createBrowserExportPort,
  createUnavailableExportPort,
} from './export/browser-port';
import type { ExportPort } from './export/port';
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
import './worksheet/worksheet.css';
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
const defaultExportPort = isTauri()
  ? createUnavailableExportPort()
  : createBrowserExportPort();

function App({
  filePort = defaultPort,
  exportPort = defaultExportPort,
  menuEvents = tauriMenuEvents,
}: {
  filePort?: FilePort;
  exportPort?: ExportPort;
  menuEvents?: MenuEvents;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <WorksheetProvider>
      <FileCommands
        port={filePort}
        menuEvents={menuEvents}
        onFileChange={(file) => setFileName(file?.name ?? null)}
      />
      <ExportCommands
        port={exportPort}
        filePort={filePort}
        fileName={fileName}
        menuEvents={menuEvents}
      />
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
