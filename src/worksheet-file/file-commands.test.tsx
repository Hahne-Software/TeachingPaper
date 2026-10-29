// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { emptyMetadata } from '../worksheet/metadata';
import { encodeWorksheet } from './codec';
import { createFakePort } from './fake-port';
import type { MenuEvents } from './file-commands';

function setup() {
  const { port, fake } = createFakePort();
  const handlers = new Set<(id: string) => void>();
  const menuEvents: MenuEvents = (handler) => {
    handlers.add(handler);
    return () => void handlers.delete(handler);
  };
  render(<App filePort={port} menuEvents={menuEvents} />);
  return {
    fake,
    menu: (id: string) => act(async () => handlers.forEach((h) => h(id))),
    key: (key: string, modifiers = '') =>
      userEvent.keyboard(`{Control>}${modifiers}${key}{/Control}`),
  };
}

const addHeading = async (text: string) => {
  await userEvent.click(screen.getByRole('button', { name: 'Heading' }));
  // jsdom does not treat contenteditable="plaintext-only" as editable, so type by hand.
  const heading = document.querySelector<HTMLElement>('.heading')!;
  heading.textContent = text;
  fireEvent.input(heading);
};
const headings = () =>
  Array.from(document.querySelectorAll('.heading'), (h) => h.textContent);
const lastTitle = (fake: { titles: string[] }) =>
  fake.titles[fake.titles.length - 1];

describe('Worksheet File commands', () => {
  it('asks for a location on the first Save, then rewrites the same file silently', async () => {
    const { fake, menu } = setup();
    await addHeading('Rome');
    fake.answerSave('rome.tpsheet');

    await menu('file-save');
    await menu('file-save');

    expect(fake.saveDialogs).toBe(1);
    expect(fake.writes).toEqual(['rome.tpsheet', 'rome.tpsheet']);
  });

  it('saves a Worksheet that opens again unchanged', async () => {
    const { fake, menu } = setup();
    await addHeading('Rome');
    fake.answerSave('rome.tpsheet');
    await menu('file-save');
    await userEvent.click(
      document.querySelector<HTMLElement>('[aria-label="Delete Block"]')!,
    );
    expect(headings()).toEqual([]);

    fake.answerOpen('rome.tpsheet');
    await menu('open-file');

    await waitFor(() => expect(headings()).toEqual(['Rome']));
  });

  it('Save As always asks and switches to the new file', async () => {
    const { fake, menu } = setup();
    await addHeading('Rome');
    fake.answerSave('a.tpsheet');
    await menu('file-save');
    fake.answerSave('b.tpsheet');
    await menu('file-save-as');
    await menu('file-save');

    expect(fake.saveDialogs).toBe(2);
    expect(fake.writes).toEqual(['a.tpsheet', 'b.tpsheet', 'b.tpsheet']);
    expect(lastTitle(fake)).toBe('b.tpsheet — TeachingPaper');
  });

  it('changes nothing when a dialog is cancelled', async () => {
    const { fake, menu } = setup();
    await addHeading('Rome');

    fake.answerSave(null);
    await menu('file-save');
    fake.answerOpen(null);
    await menu('open-file');

    expect(fake.writes).toEqual([]);
    expect(headings()).toEqual(['Rome']);
    expect(lastTitle(fake)).toBe('TeachingPaper');
  });

  it('works through Ctrl+S, Ctrl+Shift+S and Ctrl+O', async () => {
    const { fake, key } = setup();
    fake.files.set(
      'x.tpsheet',
      encodeWorksheet({
        metadata: emptyMetadata,
        blocks: [{ type: 'heading', data: { text: 'X', level: 1 } }],
      }),
    );

    fake.answerOpen('x.tpsheet');
    await key('o');
    await waitFor(() => expect(headings()).toEqual(['X']));
    await key('s');
    fake.answerSave('y.tpsheet');
    await key('s', '{Shift>}');

    await waitFor(() =>
      expect(fake.writes).toEqual(['x.tpsheet', 'y.tpsheet']),
    );
    expect(fake.openDialogs).toBe(1);
  });

  it('shows the current file name in the window title', async () => {
    const { fake, menu } = setup();
    expect(lastTitle(fake)).toBe('TeachingPaper');
    fake.files.set(
      'x.tpsheet',
      encodeWorksheet({ metadata: emptyMetadata, blocks: [] }),
    );

    fake.answerOpen('x.tpsheet');
    await menu('open-file');

    await waitFor(() =>
      expect(lastTitle(fake)).toBe('x.tpsheet — TeachingPaper'),
    );
  });
});
