// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
const insert = (name: string) =>
  userEvent.click(screen.getByRole('button', { name }));
const hint = () => screen.queryByText('Drag a Block here from the left');

/** Moves focus out of the Block's text while keeping the Block selected. */
const blurText = () => (document.activeElement as HTMLElement).blur();

describe('deleting Blocks', () => {
  it('removes a Block with the delete button on its handle', async () => {
    setup();
    await insert('Heading');
    await insert('Body Text');

    await userEvent.click(
      blocks()[0].querySelector<HTMLElement>('[aria-label="Delete Block"]')!,
    );

    expect(blocks()).toHaveLength(1);
    expect(blocks()[0].querySelector('.heading')).toBeNull();
  });

  it('shows the empty-Worksheet hint again after deleting the last Block', async () => {
    setup();
    await insert('Heading');
    expect(hint()).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Block' }));

    expect(hint()).not.toBeNull();
  });

  it.each(['{Delete}', '{Backspace}'])(
    'removes the selected Block on %s when its text is not focused',
    async (key) => {
      setup();
      await insert('Heading');
      blurText();

      await userEvent.keyboard(key);

      expect(blocks()).toHaveLength(0);
    },
  );

  it.each(['{Delete}', '{Backspace}'])(
    'never removes the Block on %s while typing in its text',
    async (key) => {
      setup();
      await insert('Heading');
      await waitFor(() =>
        expect(blocks()[0].querySelector('.heading')).toHaveFocus(),
      );

      await userEvent.keyboard(key);

      expect(blocks()).toHaveLength(1);
    },
  );
});
