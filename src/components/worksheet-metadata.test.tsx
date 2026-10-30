// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render-app';
import { decodeWorksheet } from '../worksheet-file/codec';

const fieldNames = ['Title', 'Grade Level', 'Subject', 'Topic'];
const field = (name: string) => screen.getByRole('textbox', { name });
const panel = () =>
  screen.getByRole('complementary', { name: 'Properties Panel' });
const deselect = () =>
  userEvent.click(document.querySelector<HTMLElement>('.document-area')!);

describe('Worksheet Metadata in the Properties Panel', () => {
  it('shows Title, Grade Level, Subject and Topic when no Block is selected', () => {
    renderApp();

    fieldNames.forEach((name) => expect(field(name)).toHaveValue(''));
  });

  it('shows the selected Block’s settings instead, and the Metadata again after deselecting', async () => {
    renderApp();
    await userEvent.type(field('Title'), 'Ancient Rome');

    await userEvent.click(screen.getByRole('button', { name: 'Heading' }));

    expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
    expect(panel()).toHaveTextContent('Heading Level');

    await deselect();

    expect(field('Title')).toHaveValue('Ancient Rome');
  });

  it('turns pasted line breaks into spaces', async () => {
    renderApp();
    await userEvent.type(field('Topic'), 'Rome ');

    await userEvent.paste('Forum\r\nand\nbaths');

    expect(field('Topic')).toHaveValue('Rome Forum and baths');
  });

  it('pastes over the selection and leaves the caret after the pasted text', async () => {
    renderApp();
    await userEvent.type(field('Title'), 'Daily XXX in Rome');
    const title = field('Title') as HTMLInputElement;
    title.setSelectionRange(6, 9);

    await userEvent.paste('life\nand work');

    expect(title).toHaveValue('Daily life and work in Rome');
    expect([title.selectionStart, title.selectionEnd]).toEqual([19, 19]);
  });

  it('saves the Metadata and restores it on Open', async () => {
    const { fake, menu } = renderApp();
    await userEvent.type(field('Title'), 'Daily life');
    await userEvent.type(field('Grade Level'), '7/8');
    await userEvent.type(field('Subject'), 'History');
    fake.answerSave('rome.tpsheet');
    await menu('file-save');

    expect(decodeWorksheet(fake.files.get('rome.tpsheet')!).metadata).toEqual({
      title: 'Daily life',
      gradeLevel: '7/8',
      subject: 'History',
      topic: '',
    });

    await userEvent.clear(field('Title'));
    await userEvent.clear(field('Subject'));
    fake.answerQuestion('discard');
    fake.answerOpen('rome.tpsheet');
    await menu('open-file');

    await waitFor(() => expect(field('Title')).toHaveValue('Daily life'));
    expect(field('Grade Level')).toHaveValue('7/8');
    expect(field('Subject')).toHaveValue('History');
    expect(field('Topic')).toHaveValue('');
  });
});
