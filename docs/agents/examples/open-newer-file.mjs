// Opens a Format Version 1.1 Worksheet with an Unsupported Block in WebKitGTK and answers the confirm that Export raises for Unsupported Blocks.
// Usage: pnpm verify:ui docs/agents/examples/open-newer-file.mjs <out-dir>
// Adapt the XML and the answers; `dialogs.asked()` lists every confirm and alert message shown.
import { strToU8, zipSync } from '../../../node_modules/fflate/esm/index.mjs';
const NS = 'https://hahne.software/ns/teachingpaper/worksheet';
const bytes = zipSync({
  mimetype: [
    strToU8('application/vnd.teachingpaper.worksheet+zip'),
    { level: 0 },
  ],
  'worksheet.xml': strToU8(
    `<worksheet xmlns="${NS}" version="1.1"><blocks><heading level="1">Before</heading><map zoom="3"/><heading level="2">After</heading></blocks></worksheet>`,
  ),
});
export default async ({ exec, sleep, shot, dialogs, files }) => {
  await dialogs.stub();
  await files.stub();
  await files.offer(bytes);
  await exec(
    `window.dispatchEvent(new KeyboardEvent('keydown',{key:'o',ctrlKey:true,bubbles:true}))`,
  );
  await sleep(800);
  await shot('1-unsupported');
  const ctrlE = () =>
    exec(
      `window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',ctrlKey:true,bubbles:true}))`,
    );
  dialogs.answer(false);
  await ctrlE();
  await sleep(500);
  console.log('after Cancel:', JSON.stringify(await dialogs.asked()));
  dialogs.answer(true);
  await ctrlE();
  await sleep(800);
  console.log('after Export anyway:', JSON.stringify(await dialogs.asked()));
};
