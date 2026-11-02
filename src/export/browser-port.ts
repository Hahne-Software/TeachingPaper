import type { ExportPort } from './port';

/**
 * ExportPort for a plain browser: a browser cannot ask for a location or print silently, so the
 * export document opens in a new window and its print dialog takes over.
 */
export const createBrowserExportPort = (): ExportPort => ({
  showExportDialog: async (suggestedName) => ({ name: suggestedName }),
  printToPdf: async (html) => {
    const win = window.open('', '_blank');
    if (!win) throw new Error('The browser blocked the window for printing.');
    win.document.open();
    win.document.write(html);
    win.document.close();
    await win.document.fonts.ready;
    win.focus();
    win.print();
  },
});

/** Stand-in for the desktop app until its native print-to-PDF exists. */
export const createUnavailableExportPort = (): ExportPort => ({
  showExportDialog: async (suggestedName) => ({ name: suggestedName }),
  printToPdf: async () => {
    throw new Error('Exporting is not available in the desktop app yet.');
  },
});
