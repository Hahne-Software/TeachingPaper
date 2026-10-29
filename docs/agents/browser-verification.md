# Verifying UI in a real browser

jsdom has no layout, scrolling or engine behaviour, so drag, scroll, focus and caret bugs only show in a real browser. Tauri renders with WebKitGTK on Linux: check focus, caret and selection there, because Firefox passing proves nothing about them.

## Done means seen

A UI change counts as verified only after you have read, with the Read tool, a WebKitGTK screenshot of each new or changed state (resting, hover, selected). DOM values such as `display` or coordinates cannot show an ugly, misaligned or cramped control. Report which engine you checked and which states you did not look at (for example dark mode).

## WebKitGTK (the Tauri engine)

Run `pnpm verify:ui <steps-file.mjs> <out-dir>`. It starts `pnpm dev` when port 1420 is free, stops it afterwards, and strips the Nix `LD_*` variables. The browser opens full screen, so the viewport is the screen size. The steps file (written in the scratchpad) gets `click`, `key`, `chord`, `drag`, `drop`, `exec`, `shot`, `sleep` and `files`; the header of the script has the details. `click` hits the first match only, so reach any other element with `exec` (`document.querySelectorAll(sel)[1].click()`). `drag(from, to, { hover, release })` moves the real mouse; pass `release: false`, take a `shot` of the drag in progress, then `drop()`.

`exec` runs its text as a function body, so a result needs `return` (`exec('return document.title')`). `key` presses keys one after another; `chord` holds them together (`chord('\uE008', '\uE007')` is Shift+Enter in the focused element). App shortcuts listen on `window`: dispatch `new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })` there through `exec`. Native file dialogs cannot be driven: call `files.stub()` after each page load, then `files.offer(bytes)` answers the next Open and `files.saved()` returns the bytes of the last Save.

## Firefox (no browser tool connected)

1. Install `puppeteer-core` in the scratchpad directory, never in the repo (`PUPPETEER_SKIP_DOWNLOAD=1 npm i puppeteer-core`).
2. Launch `puppeteer.launch({ browser: 'firefox', executablePath: <resolved firefox>, headless: true, defaultViewport: { width: 1280, height: 1300 } })`. A tall viewport keeps the whole Page on screen, because Puppeteer rejects mouse targets outside the viewport.
3. Run node with `env -u LD_LIBRARY_PATH -u LD_PRELOAD`. The Nix shell's glibc stops Firefox from loading.
4. Drive the real mouse (`page.mouse.move/down/up`) in many small steps with a short sleep between them.
5. Read results from `document.activeElement`, `getSelection().rangeCount` and the DOM.

## WebKitGTK by hand

For input the script cannot express: start `WebKitWebDriver --port=4444` from the `webkitgtk` store path (`$(dirname $(which WebKitWebDriver))`), create a W3C session with `browserName: 'MiniBrowser'`, `webkitgtk:browserOptions.binary` set to `<webkitgtk>/libexec/webkit2gtk-4.1/MiniBrowser` and `args: ['--automation']`, then use `/actions` for pointer and key input. Type after an action to prove the caret exists: `document.activeElement` can be right while keystrokes land nowhere.

## Cleanup

Stop every server and driver you start, by PID (`kill <pid>`; find it with `ss -ltnp | grep 1420`). `pkill -f` can match your own shell. `pnpm verify:ui` cleans up after itself; a `pnpm dev` you started by hand holds port 1420 and stops `pnpm tauri dev` from starting (`strictPort`).
