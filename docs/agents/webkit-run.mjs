// Drives the app in WebKitGTK (the Tauri engine) through WebKitWebDriver. No dependencies.
// Usage (dev server on :1420 running): node docs/agents/webkit-run.mjs <steps-file.mjs> <out-dir>
// The steps file default-exports `async ({ exec, key, click, shot, sleep }) => {}`.
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
          args: ['--automation'],
        },
      },
    },
  });
  const sp = `/session/${session.sessionId}`;
  await call('POST', `${sp}/url`, { url: 'http://localhost:1420' });
  await call('POST', `${sp}/window/rect`, { width: 1400, height: 1000 });
  await sleep(1500);

  const helpers = {
    sleep,
    /** Runs a script in the page; `return` its result. */
    exec: (script, args = []) =>
      call('POST', `${sp}/execute/sync`, { script, args }),
    /** Sends key presses, e.g. key('a', '') (W3C key codes: Backspace , Delete ). */
    key: (...keys) =>
      call('POST', `${sp}/actions`, {
        actions: [
          {
            type: 'key',
            id: 'k',
            actions: keys.flatMap((value) => [
              { type: 'keyDown', value },
              { type: 'keyUp', value },
            ]),
          },
        ],
      }),
    /** Real click on the first element matching the CSS selector. */
    click: async (selector) => {
      const found = await call('POST', `${sp}/element`, {
        using: 'css selector',
        value: selector,
      });
      await call('POST', `${sp}/element/${Object.values(found)[0]}/click`, {});
    },
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
}
