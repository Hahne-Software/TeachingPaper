// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { afterDrag, dragFrom, drop, stubLayout } from '../test/dnd';
import { WorksheetProvider } from '../worksheet/context';
import { BlockPalette } from './BlockPalette';
import { Worksheet } from './Worksheet';
import { WorksheetDnd } from './WorksheetDnd';

function setup() {
  render(
    <WorksheetProvider>
      <WorksheetDnd>
        <BlockPalette />
        <Worksheet />
      </WorksheetDnd>
    </WorksheetProvider>,
  );
}

const blocks = () => Array.from(document.querySelectorAll('.block'));
const entry = (name: string) => screen.getByRole('button', { name });

const drag = (name: string, to: { x: number; y: number }) =>
  dragFrom(entry(name), to);

describe('dragging a Block Type from the Block Palette', () => {
  beforeEach(stubLayout);
  afterEach(afterDrag);

  it('still inserts a Block when an entry is clicked', async () => {
    setup();
    await userEvent.click(entry('Heading'));
    expect(blocks()).toHaveLength(1);
    expect(blocks()[0]).toHaveClass('block-selected');
    await waitFor(() =>
      expect(document.querySelector('.heading')).toHaveFocus(),
    );
  });

  async function seedTwoBlocks() {
    await userEvent.click(entry('Heading'));
    await userEvent.click(entry('Body Text'));
  }

  it('shows an insertion line at the would-be drop position', async () => {
    setup();
    await seedTwoBlocks();
    await drag('Heading', { x: 500, y: 120 });
    const line = await screen.findByRole('separator');
    const lineParent = line.parentElement!;
    expect(Array.from(lineParent.children).indexOf(line)).toBe(
      Array.from(lineParent.children).indexOf(blocks()[1]) - 1,
    );
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
  });

  it('inserts a selected, focused Block at the drop position', async () => {
    setup();
    await seedTwoBlocks();
    await drag('Heading', { x: 500, y: 120 });
    await screen.findByRole('separator');
    drop({ x: 500, y: 120 });
    await waitFor(() => expect(blocks()).toHaveLength(3));
    expect(blocks()[1]).toHaveClass('block-selected');
    expect(blocks()[1].querySelector('.heading')).not.toBeNull();
    expect(blocks()[0].querySelector('.heading')).not.toBeNull();
    expect(blocks()[2].querySelector('.heading')).toBeNull();
    await waitFor(() =>
      expect(blocks()[1].querySelector('[contenteditable]')).toHaveFocus(),
    );
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('appends when dropped on the empty remainder of the Page', async () => {
    setup();
    await seedTwoBlocks();
    await drag('Body Text', { x: 500, y: 800 });
    drop({ x: 500, y: 800 });
    await waitFor(() => expect(blocks()).toHaveLength(3));
    expect(blocks()[2]).toHaveClass('block-selected');
  });

  it('appends on an empty Worksheet', async () => {
    setup();
    await drag('Heading', { x: 500, y: 300 });
    drop({ x: 500, y: 300 });
    await waitFor(() => expect(blocks()).toHaveLength(1));
  });

  it('changes nothing when dropped outside the Worksheet', async () => {
    setup();
    await seedTwoBlocks();
    await drag('Heading', { x: 100, y: 500 });
    drop({ x: 100, y: 500 });
    expect(blocks()).toHaveLength(2);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('changes nothing when dropped on the grey area beside the Page', async () => {
    setup();
    await seedTwoBlocks();
    await drag('Heading', { x: 250, y: 120 });
    expect(screen.queryByRole('separator')).toBeNull();
    drop({ x: 250, y: 120 });
    expect(blocks()).toHaveLength(2);
  });

  it('changes nothing when cancelled with Escape', async () => {
    setup();
    await seedTwoBlocks();
    await drag('Heading', { x: 500, y: 120 });
    await screen.findByRole('separator');
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    drop({ x: 500, y: 120 });
    expect(blocks()).toHaveLength(2);
    expect(screen.queryByRole('separator')).toBeNull();
  });
});
