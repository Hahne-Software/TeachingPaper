import { renderToStaticMarkup } from 'react-dom/server';
import { definitionFor } from '../blocks/registry';
import { offsetInPage, type PageLayout } from '../worksheet/layout';
import type { WorksheetMetadata } from '../worksheet/metadata';
import { PAGE_CONTENT_WIDTH, PAGE_MARGIN } from '../worksheet/page-format';
import type { Block } from '../worksheet/reducer';
import worksheetCss from '../worksheet/worksheet.css?inline';
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?inline';
import inter400Italic from '@fontsource/inter/files/inter-latin-400-italic.woff2?inline';
import inter700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?inline';
import inter700Italic from '@fontsource/inter/files/inter-latin-700-italic.woff2?inline';

/** One self-contained HTML document of a Worksheet; every Export Format starts from it. */
export type ExportDocument = { html: string };

/**
 * A4 is 297 mm high, but WebKitGTK spills a Page of exactly that height onto an extra blank page
 * (ADR-0004), so each Page is a little shorter. Blocks are placed in px and are not affected.
 */
const EXPORT_PAGE_HEIGHT = '296.5mm';

const fontFaces = [
  { src: inter400, weight: 400, style: 'normal' },
  { src: inter400Italic, weight: 400, style: 'italic' },
  { src: inter700, weight: 700, style: 'normal' },
  { src: inter700Italic, weight: 700, style: 'italic' },
]
  .map(
    ({ src, weight, style }) =>
      `@font-face{font-family:'Inter';font-weight:${weight};font-style:${style};src:url(${src}) format('woff2')}`,
  )
  .join('\n');

const exportCss = `
@page{size:A4;margin:0}
html,body{margin:0;background:#fff}
body{font-family:'Inter';font-size:16px;color:#0f0f0f}
.export-page{position:relative;width:210mm;height:${EXPORT_PAGE_HEIGHT};overflow:hidden;break-after:page;page-break-after:always}
.export-page:last-child{break-after:auto;page-break-after:auto}
.export-block{position:absolute;left:${PAGE_MARGIN}px;width:${PAGE_CONTENT_WIDTH}px;overflow:hidden}
`;

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );

const blockMarkup = (block: Block, top: number, height: number) => {
  const definition = definitionFor(block.type);
  const { ExportView } = definition ?? {};
  const content = ExportView
    ? renderToStaticMarkup(<ExportView data={block.data} />)
    : '';
  return `<div class="export-block" style="top:${top}px;height:${height}px">${content}</div>`;
};

/**
 * Builds the export document from the Worksheet and the layout the editor computed. Nothing is
 * measured again: each Block sits at the Page and offset the editor gave it (ADR-0001).
 */
export const buildExportDocument = ({
  metadata,
  blocks,
  layout,
}: {
  metadata: WorksheetMetadata;
  blocks: Block[];
  layout: PageLayout;
}): ExportDocument => {
  const pages = layout.pageHeights.map((_, page) =>
    blocks
      .map((block, index) => ({ block, placement: layout.placements[index] }))
      .filter(({ placement }) => placement?.page === page)
      .map(({ block, placement }) =>
        blockMarkup(block, offsetInPage(placement), placement.height),
      )
      .join(''),
  );
  const body = (pages.length > 0 ? pages : ['']).map(
    (content) => `<div class="export-page">${content}</div>`,
  );
  return {
    html: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(metadata.title)}</title>
<style>
${fontFaces}
${worksheetCss}
${exportCss}
</style>
</head>
<body>
${body.join('\n')}
</body>
</html>
`,
  };
};
