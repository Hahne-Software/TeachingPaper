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
/** Block Types in Worksheet order, as the marker class of each rendered Block. */
const order = () =>
  blocks().map((b) => (b.querySelector('.heading') ? 'heading' : 'body'));
const grip = (index: number) =>
  blocks()[index].querySelector<HTMLElement>('[aria-label="Drag Block"]')!;

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
      if (this.classList.contains('block-grip')) return rect(0, 28, 270, 28);
      return rect(0, 0, 0, 0);
    },
  );
}

const pointer = (clientX: number, clientY: number) => ({
  clientX,
  clientY,
  button: 0,
  isPrimary: true,
  pointerId: 1,
});

const dragFrom = async (source: HTMLElement, to: { x: number; y: number }) => {
  fireEvent.pointerDown(source, pointer(280, 10));
  for (const offset of [0, 1, 2]) {
    fireEvent.pointerMove(document, pointer(to.x, to.y + offset));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  }
};

const drop = (at: { x: number; y: number }) =>
  fireEvent.pointerUp(document, pointer(at.x, at.y));

async function seedHeadingThenBody() {
  await userEvent.click(screen.getByRole('button', { name: 'Heading' }));
  await userEvent.click(screen.getByRole('button', { name: 'Body Text' }));
}

describe('reordering Blocks by dragging their grip', () => {
  beforeEach(stubLayout);
  afterEach(async () => {
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    vi.restoreAllMocks();
  });

  it('shows a drag grip on every Block handle', async () => {
    setup();
    await seedHeadingThenBody();
    expect(grip(0)).not.toBeNull();
    expect(grip(1)).not.toBeNull();
  });

  it('shows the insertion line while dragging a Block', async () => {
    setup();
    await seedHeadingThenBody();
    await dragFrom(grip(0), { x: 500, y: 180 });
    expect(await screen.findByRole('separator')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
  });

  it('moves the Block to the drop position and keeps it selected', async () => {
    setup();
    await seedHeadingThenBody();
    // The Body Text Block was inserted last, so it is the selected one.
    await dragFrom(grip(1), { x: 500, y: 20 });
    await screen.findByRole('separator');
    drop({ x: 500, y: 20 });
    await waitFor(() => expect(order()).toEqual(['body', 'heading']));
    expect(blocks()[0]).toHaveClass('block-selected');
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('moves a Block towards the end', async () => {
    setup();
    await seedHeadingThenBody();
    await dragFrom(grip(0), { x: 500, y: 180 });
    drop({ x: 500, y: 180 });
    await waitFor(() => expect(order()).toEqual(['body', 'heading']));
  });

  it('does not insert a new Block', async () => {
    setup();
    await seedHeadingThenBody();
    await dragFrom(grip(0), { x: 500, y: 180 });
    drop({ x: 500, y: 180 });
    await waitFor(() => expect(order()).toEqual(['body', 'heading']));
    expect(blocks()).toHaveLength(2);
  });

  it('does not drag when the Block content is pressed', async () => {
    setup();
    await seedHeadingThenBody();
    const content = blocks()[0].querySelector<HTMLElement>('.block-content')!;
    await dragFrom(content, { x: 500, y: 180 });
    expect(screen.queryByRole('separator')).toBeNull();
    drop({ x: 500, y: 180 });
    expect(order()).toEqual(['heading', 'body']);
  });

  it('changes nothing when cancelled with Escape', async () => {
    setup();
    await seedHeadingThenBody();
    await dragFrom(grip(0), { x: 500, y: 180 });
    await screen.findByRole('separator');
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    drop({ x: 500, y: 180 });
    expect(order()).toEqual(['heading', 'body']);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('changes nothing when dropped outside the Worksheet', async () => {
    setup();
    await seedHeadingThenBody();
    await dragFrom(grip(0), { x: 100, y: 500 });
    drop({ x: 100, y: 500 });
    expect(order()).toEqual(['heading', 'body']);
    expect(screen.queryByRole('separator')).toBeNull();
  });
});
