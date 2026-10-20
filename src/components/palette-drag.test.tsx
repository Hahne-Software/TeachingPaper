// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

/** jsdom has no layout: Blocks are 100px tall, stacked; the Worksheet area is 0-1000px. */
function stubLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const rect = (top: number, height: number, left = 300, width = 600) =>
        ({
          top,
          bottom: top + height,
          height,
          left,
          right: left + width,
          width,
          x: left,
          y: top,
          toJSON: () => ({}),
        }) as DOMRect;
      if (this.classList.contains('block')) {
        return rect(blocks().indexOf(this) * 100, 100);
      }
      if (this.classList.contains('document-area'))
        return rect(0, 1000, 200, 800);
      if (this.classList.contains('page-stack')) return rect(0, 1000, 300, 600);
      if (this.classList.contains('palette-entry')) return rect(0, 40, 0, 200);
      return rect(0, 0, 0, 0);
    },
  );
}

const drag = async (name: string, to: { x: number; y: number }) => {
  fireEvent.pointerDown(entry(name), {
    clientX: 10,
    clientY: 10,
    button: 0,
    isPrimary: true,
    pointerId: 1,
  });
  // The first move past the activation distance starts the drag; later moves track it.
  for (const offset of [0, 1, 2]) {
    fireEvent.pointerMove(document, {
      clientX: to.x,
      clientY: to.y + offset,
      isPrimary: true,
      pointerId: 1,
    });
    // dnd-kit measures the drop targets after the drag starts.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  }
};

const drop = (at: { x: number; y: number }) =>
  fireEvent.pointerUp(document, {
    clientX: at.x,
    clientY: at.y,
    isPrimary: true,
    pointerId: 1,
  });

describe('dragging a Block Type from the Block Palette', () => {
  beforeEach(stubLayout);
  afterEach(async () => {
    // dnd-kit swallows the click that follows a drag until its cleanup timer has run.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    vi.restoreAllMocks();
  });

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
