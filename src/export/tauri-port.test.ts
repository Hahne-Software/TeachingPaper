import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauri = vi.hoisted(() => ({
  save: vi.fn(),
  confirm: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: tauri.save,
  confirm: tauri.confirm,
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: tauri.invoke }));

import { createTauriExportPort } from './tauri-port';

const pdf = { label: 'PDF', extension: 'pdf' };

beforeEach(() => {
  Object.values(tauri).forEach((mock) => mock.mockReset());
});

describe('Tauri ExportPort', () => {
  it('asks for the location in a native save dialog filtered to the format', async () => {
    tauri.save.mockResolvedValue('/home/anna/Rome.pdf');
    const target = await createTauriExportPort().showExportDialog(
      'Rome.pdf',
      pdf,
    );
    expect(tauri.save).toHaveBeenCalledWith({
      defaultPath: 'Rome.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    expect(target?.name).toBe('Rome.pdf');
  });

  it('returns null when the save dialog is cancelled', async () => {
    tauri.save.mockResolvedValue(null);
    expect(
      await createTauriExportPort().showExportDialog('Rome.pdf', pdf),
    ).toBeNull();
  });

  it('adds the extension to a typed name and asks before replacing an existing file', async () => {
    tauri.save.mockResolvedValue('C:\\Users\\anna\\Rome');
    tauri.invoke.mockResolvedValue(true);
    tauri.confirm.mockResolvedValue(false);
    const port = createTauriExportPort();
    expect(await port.showExportDialog('Rome.pdf', pdf)).toBeNull();
    expect(tauri.invoke).toHaveBeenCalledWith('file_exists', {
      path: 'C:\\Users\\anna\\Rome.pdf',
    });
    tauri.confirm.mockResolvedValue(true);
    const target = await port.showExportDialog('Rome.pdf', pdf);
    expect(target?.name).toBe('Rome.pdf');
  });

  it('does not ask again when the extension was typed', async () => {
    tauri.save.mockResolvedValue('/a/Rome.PDF');
    await createTauriExportPort().showExportDialog('Rome.pdf', pdf);
    expect(tauri.invoke).not.toHaveBeenCalled();
    expect(tauri.confirm).not.toHaveBeenCalled();
  });

  it('hands the export document and the chosen path to the export_pdf command', async () => {
    tauri.save.mockResolvedValue('/a/Rome.pdf');
    tauri.invoke.mockResolvedValue(undefined);
    const port = createTauriExportPort();
    const target = await port.showExportDialog('Rome.pdf', pdf);
    await port.printToPdf('<html></html>', target!);
    expect(tauri.invoke).toHaveBeenCalledWith('export_pdf', {
      html: '<html></html>',
      path: '/a/Rome.pdf',
    });
  });

  it('lets a failing command reach the caller', async () => {
    tauri.save.mockResolvedValue('/a/Rome.pdf');
    tauri.invoke.mockRejectedValue('print failed');
    const port = createTauriExportPort();
    const target = await port.showExportDialog('Rome.pdf', pdf);
    await expect(port.printToPdf('<html></html>', target!)).rejects.toThrow(
      'print failed',
    );
  });

  it('shows the pre-export notice with Export anyway and Cancel', async () => {
    tauri.confirm.mockResolvedValue(true);
    const answer = await createTauriExportPort().confirmExportProblems({
      cutOff: 1,
      unsupported: 0,
    });
    expect(answer).toBe(true);
    expect(tauri.confirm).toHaveBeenCalledWith(
      '1 Block taller than a Page will be cut off.',
      expect.objectContaining({
        kind: 'warning',
        okLabel: 'Export anyway',
        cancelLabel: 'Cancel',
      }),
    );
  });
});
