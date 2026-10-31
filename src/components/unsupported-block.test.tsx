// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { MEDIA_TYPE, decodeWorksheet } from '../worksheet-file/codec';
import { renderApp } from '../test/render-app';

const NS = 'https://hahne.software/ns/teachingpaper/worksheet';
const file = (version: string, blocks: string) =>
  zipSync({
    mimetype: [strToU8(MEDIA_TYPE), { level: 0 }],
    'worksheet.xml': strToU8(
      `<worksheet xmlns="${NS}" version="${version}"><blocks>${blocks}</blocks></worksheet>`,
    ),
    'media/map.png': Uint8Array.of(1, 2, 3),
  });
const map = '<map zoom="3"/>';
const newer = file('1.1', `${map}<heading level="1">Rome</heading>`);

const open = async (bytes: Uint8Array) => {
  const app = renderApp();
  app.fake.files.set('a.tpsheet', bytes);
  app.fake.answerOpen('a.tpsheet');
  await app.menu('open-file');
  return app;
};

describe('Unsupported Blocks', () => {
  it('shows a notice and a read-only view for a newer file', async () => {
    await open(newer);
    expect(await screen.findByText(/newer Format Version/)).toBeTruthy();
    const block = await screen.findByRole('note');
    expect(block).toHaveTextContent('Unsupported Block');
    expect(block).toHaveTextContent('<map>');
    expect(block.querySelector('[contenteditable]')).toBeNull();
  });

  it('shows no notice for a 1.0 file', async () => {
    await open(file('1.0', '<heading level="1">Rome</heading>'));
    await screen.findByRole('heading', { name: 'Rome' });
    expect(screen.queryByText(/newer Format Version/)).toBeNull();
  });

  it('does not offer Unsupported Blocks in the Block Palette', async () => {
    await open(newer);
    await screen.findByRole('note');
    const palette = screen.getByRole('complementary', { name: /palette/i });
    expect(within(palette).queryByText(/unsupported/i)).toBeNull();
  });

  it('can be deleted, and the rest is saved with the read version and entries', async () => {
    const app = await open(newer);
    const note = await screen.findByRole('note');
    await userEvent.click(note);
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Delete Block' })[0],
    );
    expect(screen.queryByRole('note')).toBeNull();
    app.fake.answerSave('b.tpsheet');
    await app.menu('file-save-as');
    const saved = decodeWorksheet(app.fake.files.get('b.tpsheet')!);
    expect(saved.retained.version).toBe('1.1');
    expect(saved.retained.entries['media/map.png']).toEqual(
      Uint8Array.of(1, 2, 3),
    );
    expect(saved.blocks.map((b) => b.type)).toEqual(['heading']);
  });

  it('is written back unchanged when untouched', async () => {
    const app = await open(newer);
    await screen.findByRole('note');
    app.fake.answerSave('b.tpsheet');
    await app.menu('file-save-as');
    const saved = decodeWorksheet(app.fake.files.get('b.tpsheet')!);
    expect(saved.blocks[0]).toEqual({
      type: 'unsupported',
      data: { name: 'map', xml: map },
    });
  });

  it('a new Worksheet after a newer file is saved as 1.0 without the notice', async () => {
    const app = await open(newer);
    await screen.findByRole('note');
    app.fake.answerQuestion('discard');
    await app.menu('file-new');
    expect(screen.queryByText(/newer Format Version/)).toBeNull();
  });
});
