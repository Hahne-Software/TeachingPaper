// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushResizeObservers } from '../test/setup';
import { WorksheetProvider } from '../worksheet/context';
import { BlockPalette } from './BlockPalette';
import { Worksheet } from './Worksheet';
import { WorksheetDnd } from './WorksheetDnd';

// A Page's content area is PAGE_CONTENT_HEIGHT (979px) high and Blocks are 12px apart.
let heights: number[] = [];
const original = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight',
);

beforeEach(() => {
  heights = [];
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      const index = blocks().indexOf(this);
      return index === -1 ? 0 : (heights[index] ?? 100);
    },
  });
});
afterEach(() => {
  if (original)
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
});

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

const blocks = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.block'));
const pages = () => document.querySelectorAll('.page');
const pageOf = () => blocks().map((block) => block.dataset.page);
const insert = async (name: string, height: number) => {
  heights.push(height);
  await userEvent.click(screen.getByRole('button', { name }));
};
const resize = (index: number, height: number) => {
  heights[index] = height;
  act(() => flushResizeObservers());
};

describe('automatic pagination', () => {
  it('shows the empty-Worksheet hint on a single blank Page', () => {
    setup();
    expect(pages()).toHaveLength(1);
    expect(screen.getByText('Drag a Block here from the left')).toBeVisible();
  });

  it('keeps Blocks that fit together on one Page', async () => {
    setup();
    await insert('Heading', 400);
    await insert('Heading', 400);
    expect(pages()).toHaveLength(1);
    expect(pageOf()).toEqual(['0', '0']);
  });

  it('moves a Block that does not fit to the next Page', async () => {
    setup();
    await insert('Heading', 400);
    await insert('Heading', 400);
    await insert('Heading', 400);
    expect(pages()).toHaveLength(2);
    expect(pageOf()).toEqual(['0', '0', '1']);
  });

  it('moves a Block over when it grows and pulls it back when it shrinks', async () => {
    setup();
    await insert('Heading', 400);
    await insert('Heading', 400);
    resize(0, 600);
    expect(pageOf()).toEqual(['0', '1']);
    expect(pages()).toHaveLength(2);

    resize(0, 400);
    expect(pageOf()).toEqual(['0', '0']);
    expect(pages()).toHaveLength(1);
  });

  it('removes the trailing Page when its Block is deleted', async () => {
    setup();
    await insert('Heading', 900);
    await insert('Heading', 900);
    expect(pages()).toHaveLength(2);

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Delete Block' })[1],
    );
    expect(pages()).toHaveLength(1);
  });

  it('warns about a Block taller than a Page', async () => {
    setup();
    await insert('Heading', 100);
    expect(screen.queryByRole('alert')).toBeNull();

    resize(0, 1200);
    expect(screen.getByRole('alert')).toHaveTextContent(/taller than a Page/);
  });
});
