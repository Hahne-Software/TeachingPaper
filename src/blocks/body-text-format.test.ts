import { describe, expect, it } from 'vitest';
import {
  fromTiptapDoc,
  toTiptapDoc,
  type BodyTextData,
  type TextRun,
} from './body-text-format';

const run = (text: string, marks: Partial<TextRun> = {}): TextRun => ({
  text,
  bold: false,
  italic: false,
  underline: false,
  ...marks,
});

const roundTrip = (data: BodyTextData) => fromTiptapDoc(toTiptapDoc(data));

describe('Body Text conversion', () => {
  it.each<[string, BodyTextData]>([
    ['plain text', { paragraphs: [[run('Hello')]] }],
    ['bold', { paragraphs: [[run('Hi', { bold: true })]] }],
    ['italic', { paragraphs: [[run('Hi', { italic: true })]] }],
    ['underline', { paragraphs: [[run('Hi', { underline: true })]] }],
    [
      'combined marks',
      {
        paragraphs: [
          [
            run('a', { bold: true, italic: true, underline: true }),
            run('b'),
            run('c', { italic: true, underline: true }),
          ],
        ],
      },
    ],
    [
      'multiple paragraphs',
      { paragraphs: [[run('One')], [run('Two ', { bold: true }), run('x')]] },
    ],
    ['an empty paragraph', { paragraphs: [[]] }],
    [
      'empty paragraphs between text',
      { paragraphs: [[run('a')], [], [run('b')]] },
    ],
  ])('round-trips %s losslessly', (_name, data) => {
    expect(roundTrip(data)).toEqual(data);
  });

  it('merges adjacent runs with identical formatting', () => {
    const doc = toTiptapDoc({
      paragraphs: [
        [
          run('a'),
          run('b'),
          run('c', { bold: true }),
          run('d', { bold: true }),
        ],
      ],
    });

    expect(fromTiptapDoc(doc)).toEqual({
      paragraphs: [[run('ab'), run('cd', { bold: true })]],
    });
  });

  it('drops empty runs', () => {
    expect(roundTrip({ paragraphs: [[run(''), run('a')]] })).toEqual({
      paragraphs: [[run('a')]],
    });
  });

  it('reads Tiptap marks regardless of their order', () => {
    const data = fromTiptapDoc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'underline' }, { type: 'bold' }],
            },
          ],
        },
      ],
    });

    expect(data).toEqual({
      paragraphs: [[run('x', { bold: true, underline: true })]],
    });
  });

  it('treats an empty Tiptap document as one empty paragraph', () => {
    expect(fromTiptapDoc({ type: 'doc' })).toEqual({ paragraphs: [[]] });
  });

  it('emits no marks key for unformatted text and an empty paragraph without content', () => {
    expect(toTiptapDoc({ paragraphs: [[run('a')], []] })).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
        { type: 'paragraph' },
      ],
    });
  });
});
