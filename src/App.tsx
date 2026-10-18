import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { BlockPalette } from './components/BlockPalette';
import { PropertiesPanel } from './components/PropertiesPanel';
import { WorksheetDnd } from './components/WorksheetDnd';
import { Worksheet } from './components/Worksheet';
import { WorksheetProvider } from './worksheet/context';
import './App.css';

function App() {
  useEffect(() => {
    const unlisten = listen<string>('menu-event', (event) => {
      // Placeholder: wire menu actions (file-new, open-file, ...) to document logic.
      console.log('menu action:', event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <WorksheetProvider>
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
