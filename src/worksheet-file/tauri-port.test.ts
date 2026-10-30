import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauri = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
  readFile: vi.fn(),
  invoke: vi.fn(),
  confirm: vi.fn(),
  message: vi.fn(),
  setTitle: vi.fn(),
  onCloseRequested: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: tauri.open,
  save: tauri.save,
  confirm: tauri.confirm,
  message: tauri.message,
}));
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: tauri.readFile }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: tauri.invoke }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setTitle: tauri.setTitle,
    onCloseRequested: tauri.onCloseRequested,
  }),
}));

import { createTauriPort } from './tauri-port';

const filters = [{ name: 'Worksheet', extensions: ['tpsheet'] }];

beforeEach(() => {
  Object.values(tauri).forEach((mock) => mock.mockReset());
});

describe('Tauri FilePort', () => {
  it('opens through a native dialog filtered to .tpsheet and names the file by its base name', async () => {
    tauri.open.mockResolvedValue('/home/anna/Sheets/Rome.tpsheet');
    const ref = await createTauriPort().showOpenDialog();
    expect(tauri.open).toHaveBeenCalledWith({
      multiple: false,
      directory: false,
      filters,
    });
    expect(ref?.name).toBe('Rome.tpsheet');
  });

  it('names a Windows path by its base name', async () => {
    tauri.open.mockResolvedValue('C:\\Users\\anna\\Rome.tpsheet');
    expect((await createTauriPort().showOpenDialog())?.name).toBe(
      'Rome.tpsheet',
    );
  });

  it('returns null when the open dialog is cancelled', async () => {
    tauri.open.mockResolvedValue(null);
    expect(await createTauriPort().showOpenDialog()).toBeNull();
  });

  it('reads the bytes of the chosen file', async () => {
    tauri.open.mockResolvedValue('/a/Rome.tpsheet');
    tauri.readFile.mockResolvedValue(new Uint8Array([1, 2]));
    const port = createTauriPort();
    const ref = await port.showOpenDialog();
    expect(await port.readBytes(ref!)).toEqual(new Uint8Array([1, 2]));
    expect(tauri.readFile).toHaveBeenCalledWith('/a/Rome.tpsheet');
  });

  it('suggests the file name in a save dialog filtered to .tpsheet', async () => {
    tauri.save.mockResolvedValue('/a/Rome.tpsheet');
    const ref = await createTauriPort().showSaveDialog('Rome.tpsheet');
    expect(tauri.save).toHaveBeenCalledWith({
      defaultPath: 'Rome.tpsheet',
      filters,
    });
    expect(ref?.name).toBe('Rome.tpsheet');
  });

  it('appends .tpsheet to a name the teacher typed without extension', async () => {
    tauri.save.mockResolvedValue('/a/Rome');
    const port = createTauriPort();
    const ref = await port.showSaveDialog('Worksheet.tpsheet');
    expect(ref?.name).toBe('Rome.tpsheet');
    await port.writeBytes(ref!, new Uint8Array([7]));
    expect(tauri.invoke).toHaveBeenCalledWith(
      'write_file_atomic',
      new Uint8Array([7]),
      { headers: { path: encodeURIComponent('/a/Rome.tpsheet') } },
    );
  });

  describe('when the typed name lacks the extension and the .tpsheet file exists', () => {
    beforeEach(() => {
      tauri.save.mockResolvedValue('/a/foo');
      tauri.invoke.mockImplementation(async (command: string) =>
        command === 'file_exists' ? true : undefined,
      );
    });

    it('asks before replacing it and saves when confirmed', async () => {
      tauri.confirm.mockResolvedValue(true);
      const ref = await createTauriPort().showSaveDialog('x.tpsheet');
      expect(tauri.invoke).toHaveBeenCalledWith('file_exists', {
        path: '/a/foo.tpsheet',
      });
      expect(tauri.confirm).toHaveBeenCalledOnce();
      expect(tauri.confirm.mock.calls[0][0]).toContain('foo.tpsheet');
      expect(ref?.name).toBe('foo.tpsheet');
    });

    it('returns null when the teacher declines', async () => {
      tauri.confirm.mockResolvedValue(false);
      expect(await createTauriPort().showSaveDialog('x.tpsheet')).toBeNull();
    });
  });

  it('does not ask when the .tpsheet file does not exist yet', async () => {
    tauri.save.mockResolvedValue('/a/foo');
    tauri.invoke.mockResolvedValue(false);
    const ref = await createTauriPort().showSaveDialog('x.tpsheet');
    expect(tauri.confirm).not.toHaveBeenCalled();
    expect(ref?.name).toBe('foo.tpsheet');
  });

  it('leaves the overwrite question to the dialog when the name has the extension', async () => {
    tauri.save.mockResolvedValue('/a/foo.tpsheet');
    await createTauriPort().showSaveDialog('x.tpsheet');
    expect(tauri.invoke).not.toHaveBeenCalled();
    expect(tauri.confirm).not.toHaveBeenCalled();
  });

  it('keeps a name that already has the extension, whatever its case', async () => {
    tauri.save.mockResolvedValue('/a/ROME.TPSHEET');
    const ref = await createTauriPort().showSaveDialog('x.tpsheet');
    expect(ref?.name).toBe('ROME.TPSHEET');
  });

  it('returns null when the save dialog is cancelled', async () => {
    tauri.save.mockResolvedValue(null);
    expect(await createTauriPort().showSaveDialog('x.tpsheet')).toBeNull();
  });

  it('percent-encodes the path so non-ASCII names survive the header', async () => {
    tauri.save.mockResolvedValue('/a/Übung');
    const port = createTauriPort();
    const ref = await port.showSaveDialog('x.tpsheet');
    await port.writeBytes(ref!, new Uint8Array());
    expect(tauri.invoke.mock.lastCall?.[2].headers.path).toBe(
      '%2Fa%2F%C3%9Cbung.tpsheet',
    );
  });

  it('sets the title of the native window', () => {
    tauri.setTitle.mockResolvedValue(undefined);
    createTauriPort().setWindowTitle('Rome.tpsheet — TeachingPaper');
    expect(tauri.setTitle).toHaveBeenCalledWith('Rome.tpsheet — TeachingPaper');
  });

  describe('asking to save changes', () => {
    it("shows Save, Don't Save and Cancel buttons naming the Worksheet", async () => {
      tauri.message.mockResolvedValue('Cancel');
      await createTauriPort().askToSaveChanges('Rome.tpsheet');
      const [text, options] = tauri.message.mock.calls[0];
      expect(text).toContain('Rome.tpsheet');
      expect(options.buttons).toEqual({
        yes: 'Save',
        no: "Don't Save",
        cancel: 'Cancel',
      });
    });

    it.each([
      ['Save', 'save'],
      ['Yes', 'save'],
      ["Don't Save", 'discard'],
      ['No', 'discard'],
      ['Cancel', 'cancel'],
    ])('answers %s with %s', async (button, answer) => {
      tauri.message.mockResolvedValue(button);
      expect(await createTauriPort().askToSaveChanges('x')).toBe(answer);
    });
  });

  describe('guarding the window close', () => {
    const closeWith = async (hasUnsavedChanges: boolean, mayClose: boolean) => {
      const unlisten = vi.fn();
      tauri.onCloseRequested.mockResolvedValue(unlisten);
      const guard = {
        hasUnsavedChanges: () => hasUnsavedChanges,
        mayClose: vi.fn(async () => mayClose),
      };
      const remove = createTauriPort().onCloseRequested(guard);
      const handler = tauri.onCloseRequested.mock.calls[0][0];
      const event = { preventDefault: vi.fn() };
      await handler(event);
      return { event, guard, remove, unlisten };
    };

    it('lets the window close when there are no Unsaved Changes', async () => {
      const { event, guard } = await closeWith(false, false);
      expect(guard.mayClose).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('lets the window close when the changes are settled', async () => {
      const { event } = await closeWith(true, true);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('keeps the window open when settling is cancelled', async () => {
      const { event } = await closeWith(true, false);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('stops listening when the guard is removed', async () => {
      const { remove, unlisten } = await closeWith(false, false);
      remove();
      await Promise.resolve();
      expect(unlisten).toHaveBeenCalled();
    });
  });
});
