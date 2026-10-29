// Drives the app in WebKitGTK (the Tauri engine) through WebKitWebDriver. Needs only the repo's own fflate.
// Usage: pnpm verify:ui <steps-file.mjs> <out-dir>
// Starts `pnpm dev` when :1420 is free and stops it afterwards; a server that was already running stays up.
// The steps file default-exports `async ({ exec, key, chord, paste, click, drag, drop, shot, sleep, files }) => {}`.
// `click` hits the first match only; reach any other element with `exec` (e.g. `document.querySelectorAll(sel)[1].click()`).
import { strFromU8, unzipSync } from 'fflate';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [stepsFile, outDir] = process.argv.slice(2);
if (!stepsFile || !outDir) {
  console.error('usage: webkit-run.mjs <steps-file.mjs> <out-dir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const devUrl = 'http://localhost:1420';
const devUp = () =>
  fetch(devUrl).then(
    () => true,
    () => false,
  );
// Own process group, so stopping it takes vite down with pnpm.
const devServer = (await devUp())
  ? null
  : spawn('pnpm', ['dev'], { stdio: 'ignore', detached: true });
const stopDevServer = () => {
  if (devServer?.pid) process.kill(-devServer.pid);
};
for (let waited = 0; devServer && !(await devUp()); waited += 250) {
  if (waited > 30000) {
    stopDevServer();
    throw new Error('dev server did not come up on :1420');
  }
  await new Promise((r) => setTimeout(r, 250));
}

const driverPath = execFileSync('which', ['WebKitWebDriver'], {
  encoding: 'utf8',
}).trim();
const webkit = dirname(dirname(realpathSync(driverPath)));
const base = 'http://localhost:4444';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const driver = spawn(driverPath, ['--port=4444'], { stdio: 'ignore' });
const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await res.json()).value;
};

try {
  for (let i = 0; i < 20; i++) {
    if (
      await fetch(base + '/status').then(
        () => true,
        () => false,
      )
    )
      break;
    await sleep(250);
  }
  const session = await call('POST', '/session', {
    capabilities: {
      alwaysMatch: {
        browserName: 'MiniBrowser',
        'webkitgtk:browserOptions': {
          binary: join(webkit, 'libexec/webkit2gtk-4.1/MiniBrowser'),
          // Full screen: a tiling window manager (e.g. sway) ignores the requested window size,
          // and a narrow window scrolls the Page sideways.
          args: ['--automation', '--full-screen'],
        },
      },
    },
  });
  const sp = `/session/${session.sessionId}`;
  await call('POST', `${sp}/url`, { url: 'http://localhost:1420' });
  await sleep(1500);

  const helpers = {
    sleep,
    /** Runs a script in the page; `return` its result. */
    exec: (script, args = []) =>
      call('POST', `${sp}/execute/sync`, { script, args }),
    /**
     * Types each character of each argument in turn: key('Rome', '\uE003') types "Rome", then Backspace
     * (W3C key codes are single characters).
     */
    key: (...keys) =>
      call('POST', `${sp}/actions`, {
        actions: [
          {
            type: 'key',
            id: 'k',
            actions: keys
              .flatMap((text) => [...text])
              .flatMap((value) => [
                { type: 'keyDown', value },
                { type: 'keyUp', value },
              ]),
          },
        ],
      }),
    /** Presses keys together and releases them in reverse, e.g. chord('\uE008', '\uE007') for Shift+Enter. */
    chord: (...keys) =>
      call('POST', `${sp}/actions`, {
        actions: [
          {
            type: 'key',
            id: 'k',
            actions: [
              ...keys.map((value) => ({ type: 'keyDown', value })),
              ...[...keys].reverse().map((value) => ({ type: 'keyUp', value })),
            ],
          },
        ],
      }),
    /** Pastes `text` into the focused element, as a paste event with `text/plain` on the clipboard. */
    paste: (text) =>
      helpers.exec(
        `const transfer = new DataTransfer();
         transfer.setData('text/plain', arguments[0]);
         const event = new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true });
         // Without a handler that cancels the event, the browser inserts nothing: do it like a real paste.
         if (document.activeElement.dispatchEvent(event)) document.execCommand('insertText', false, arguments[0]);`,
        [text],
      ),
    /**
     * Stands in for the native file dialogs, which WebDriver cannot drive. Call `files.stub()` after
     * every page load; then `files.offer(bytes, name)` answers the next file picker, and
     * `files.saved()` returns the bytes of the last download as a Buffer (null if none), and
     * `files.savedXml()` its `worksheet.xml` as text.
     */
    files: {
      stub: () =>
        helpers.exec(`
          window.__download = null;
          window.__offer = null;
          HTMLAnchorElement.prototype.click = function () {
            window.__download = fetch(this.href)
              .then((response) => response.arrayBuffer())
              .then((buffer) => {
                let binary = '';
                new Uint8Array(buffer).forEach((byte) => (binary += String.fromCharCode(byte)));
                return btoa(binary);
              });
          };
          HTMLInputElement.prototype.click = function () {
            if (!window.__offer) return this.dispatchEvent(new Event('cancel'));
            const transfer = new DataTransfer();
            transfer.items.add(window.__offer);
            this.files = transfer.files;
            this.dispatchEvent(new Event('change'));
          };`),
      offer: (bytes, name = 'Worksheet.tpsheet') =>
        helpers.exec(
          `const bytes = Uint8Array.from(atob(arguments[0]), (c) => c.charCodeAt(0));
           window.__offer = new File([bytes], arguments[1]);`,
          [Buffer.from(bytes).toString('base64'), name],
        ),
      saved: async () => {
        const base64 = await helpers.exec('return window.__download');
        return base64 ? Buffer.from(base64, 'base64') : null;
      },
      savedXml: async () => {
        const bytes = await helpers.files.saved();
        return bytes ? strFromU8(unzipSync(bytes)['worksheet.xml']) : null;
      },
    },
    /** Real click on the first element matching the CSS selector. */
    click: async (selector) => {
      const found = await call('POST', `${sp}/element`, {
        using: 'css selector',
        value: selector,
      });
      await call('POST', `${sp}/element/${Object.values(found)[0]}/click`, {});
    },
    /**
     * Real mouse drag from the center of `from` to `to` (a selector, or viewport `{x, y}`), in small steps.
     * `hover` is a selector to point at first, for controls that only show on hover. Pass `release: false`
     * to stop before the drop, e.g. to take a screenshot of the drag in progress, then call `drop()`.
     */
    drag: async (from, to, { hover, release = true } = {}) => {
      const center = (selector) =>
        helpers.exec(
          `const r = document.querySelector(arguments[0]).getBoundingClientRect();
           return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };`,
          [selector],
        );
      const move = (x, y) => ({
        type: 'pointerMove',
        duration: 50,
        origin: 'viewport',
        x,
        y,
      });
      if (hover) {
        const over = await center(hover);
        await call('POST', `${sp}/actions`, {
          actions: [
            {
              type: 'pointer',
              id: 'm',
              parameters: { pointerType: 'mouse' },
              actions: [move(over.x, over.y)],
            },
          ],
        });
      }
      const start = await center(from);
      const end = typeof to === 'string' ? await center(to) : to;
      const steps = Array.from({ length: 10 }, (_, i) =>
        move(
          Math.round(start.x + ((end.x - start.x) * (i + 1)) / 10),
          Math.round(start.y + ((end.y - start.y) * (i + 1)) / 10),
        ),
      );
      await call('POST', `${sp}/actions`, {
        actions: [
          {
            type: 'pointer',
            id: 'm',
            parameters: { pointerType: 'mouse' },
            actions: [
              move(start.x, start.y),
              { type: 'pointerDown', button: 0 },
              ...steps,
              ...(release ? [{ type: 'pointerUp', button: 0 }] : []),
            ],
          },
        ],
      });
    },
    /** Releases the mouse button after `drag(..., { release: false })`. */
    drop: () =>
      call('POST', `${sp}/actions`, {
        actions: [
          {
            type: 'pointer',
            id: 'm',
            parameters: { pointerType: 'mouse' },
            actions: [{ type: 'pointerUp', button: 0 }],
          },
        ],
      }),
    /** Saves a screenshot to <out-dir>/<name>.png; read it with the Read tool. */
    shot: async (name) => {
      const png = await call('GET', `${sp}/screenshot`);
      writeFileSync(join(outDir, `${name}.png`), Buffer.from(png, 'base64'));
    },
  };

  const steps = await import(pathToFileURL(resolve(stepsFile)).href);
  await steps.default(helpers);
  await call('DELETE', sp);
} finally {
  driver.kill();
  stopDevServer();
}
