// Compares the height of a Block's editor view with its export view in WebKitGTK (Body Text as the example).
// Usage: pnpm verify:ui docs/agents/examples/export-height.mjs <out-dir>
// Adapt the typing steps and the Block Type to the Block under test; the measuring part stays the same.
const mark = (exec, k) =>
  exec(
    `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'${k}',ctrlKey:true,bubbles:true,cancelable:true}))`,
  );
export default async ({ exec, key, chord, shot, sleep }) => {
  await exec(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Body Text')).click()`,
  );
  await sleep(300);
  await exec(`document.querySelector('.tiptap').focus()`);
  await key(
    'First paragraph with some words that will wrap over several lines in the narrow page column so we see wrapping behaviour clearly.',
  );
  await mark(exec, 'b');
  await key(' bold words ');
  await mark(exec, 'b');
  await mark(exec, 'i');
  await key('italic');
  await mark(exec, 'i');
  await mark(exec, 'u');
  await key(' underlined');
  await mark(exec, 'u');
  await chord('\uE008', '\uE007');
  await key('after a line break');
  await chord('\uE008', '\uE007');
  await chord('\uE008', '\uE007');
  await key('two breaks');
  await key('\uE007');
  await key('Second paragraph');
  await key('\uE007');
  await key('\uE007');
  await key(
    'Averyveryverylongwordwithoutanyspacesthatmustbreakanywhereinsidethecolumnbecauseitistoolongtofit and then end.',
  );
  await chord('\uE008', '\uE007');
  await sleep(300);
  await exec(`(async () => {
    const renderToStaticMarkup = (m => m.renderToStaticMarkup ?? m.default.renderToStaticMarkup)(await import('/node_modules/.vite/deps/react-dom_server.js'));
    const React = (m => m.default ?? m)(await import('/node_modules/.vite/deps/react.js'));
    const { bodyTextBlockType } = await import('/src/blocks/body-text.tsx');
    const { fromTiptapDoc } = await import('/src/blocks/body-text-format.ts');
    const root = document.querySelector('.body-text');
    const data = fromTiptapDoc(document.querySelector('.tiptap').editor.getJSON());
    const html = renderToStaticMarkup(React.createElement(bodyTextBlockType.ExportView, { data }));
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:' + root.getBoundingClientRect().width + 'px';
    host.innerHTML = html;
    document.querySelector('.block').parentElement.appendChild(host);
    window.__r = { editor: root.getBoundingClientRect().height, exportView: host.querySelector('.body-text').getBoundingClientRect().height, data: JSON.stringify(data), err: null };
    window.__host = host;
  })().catch(e => { window.__r = { err: String(e) } })`);
  await sleep(1500);
  const result = JSON.parse(await exec(`return JSON.stringify(window.__r)`));
  if (result.err || result.editor !== result.exportView)
    throw new Error(
      `export view differs from editor view: ${JSON.stringify(result)}`,
    );
  console.log(`editor ${result.editor}px, export view ${result.exportView}px`);
  await shot('editor');
  await exec(
    `document.querySelector('.block').style.visibility='hidden'; window.__host.style.background='#fff'; window.__host.style.zIndex=99`,
  );
  await shot('export');
};
