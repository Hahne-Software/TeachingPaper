import type { JSONContent } from '@tiptap/core';

/** Body Text in our own format (ADR-0002); never contains Tiptap structures. */
export type TextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type BodyTextData = {
  paragraphs: TextRun[][];
};

type Mark = 'bold' | 'italic' | 'underline';
const marks: Mark[] = ['bold', 'italic', 'underline'];

const sameFormatting = (a: TextRun, b: TextRun) =>
  marks.every((mark) => a[mark] === b[mark]);

/** Drops empty runs and merges neighbours, so each content has one stored form. */
const normalizeRuns = (runs: TextRun[]): TextRun[] =>
  runs
    .filter((run) => run.text !== '')
    .reduce<TextRun[]>((merged, run) => {
      const last = merged[merged.length - 1];
      return last && sameFormatting(last, run)
        ? [...merged.slice(0, -1), { ...last, text: last.text + run.text }]
        : [...merged, { ...run }];
    }, []);

export const toTiptapDoc = (data: BodyTextData): JSONContent => ({
  type: 'doc',
  content: data.paragraphs.map((runs) => {
    const content = normalizeRuns(runs).map((run): JSONContent => {
      const active = marks.filter((mark) => run[mark]);
      return {
        type: 'text',
        text: run.text,
        ...(active.length > 0 && { marks: active.map((type) => ({ type })) }),
      };
    });
    return content.length > 0
      ? { type: 'paragraph', content }
      : { type: 'paragraph' };
  }),
});

export const fromTiptapDoc = (doc: JSONContent): BodyTextData => {
  const paragraphs = (doc.content ?? []).map((paragraph) =>
    normalizeRuns(
      (paragraph.content ?? []).map((node) => {
        const types = (node.marks ?? []).map((mark) => mark.type);
        return {
          text: node.text ?? '',
          bold: types.includes('bold'),
          italic: types.includes('italic'),
          underline: types.includes('underline'),
        };
      }),
    ),
  );
  return { paragraphs: paragraphs.length > 0 ? paragraphs : [[]] };
};
