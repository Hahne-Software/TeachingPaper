import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
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
    <main className="document-area">
      <div className="page" />
    </main>
  );
}

export default App;
