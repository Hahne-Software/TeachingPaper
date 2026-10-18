# Verifying UI in a real browser

jsdom has no layout, scrolling or engine behaviour, so drag, scroll, focus and caret bugs only show in a real browser. Tauri renders with WebKitGTK on Linux: check focus, caret and selection there, because Firefox passing proves nothing about them.

## Firefox (no browser tool connected)

1. Install `puppeteer-core` in the scratchpad directory, never in the repo (`PUPPETEER_SKIP_DOWNLOAD=1 npm i puppeteer-core`).
2. Launch `puppeteer.launch({ browser: 'firefox', executablePath: <resolved firefox>, headless: true, defaultViewport: { width: 1280, height: 1300 } })`. A tall viewport keeps the whole Page on screen, because Puppeteer rejects mouse targets outside the viewport.
3. Run node with `env -u LD_LIBRARY_PATH -u LD_PRELOAD`. The Nix shell's glibc stops Firefox from loading.
4. Drive the real mouse (`page.mouse.move/down/up`) in many small steps with a short sleep between them.
5. Read results from `document.activeElement`, `getSelection().rangeCount` and the DOM.

## WebKitGTK (the Tauri engine)

1. Start `WebKitWebDriver --port=4444` from the `webkitgtk` store path (`$(dirname $(which WebKitWebDriver))`).
2. Create a W3C session with `browserName: 'MiniBrowser'` and `webkitgtk:browserOptions.binary` set to `<webkitgtk>/libexec/webkit2gtk-4.1/MiniBrowser`, `args: ['--automation']`, over plain `fetch`.
3. Use `/actions` for pointer and key input, and `/execute/sync` to read state. A window opens on the desktop.
4. Type after an action to prove the caret exists: `document.activeElement` can be right while keystrokes land nowhere.

## Cleanup

Stop every server and driver you start, by PID (`kill <pid>`; find it with `ss -ltnp | grep 1420`). `pkill -f` can match your own shell. A leftover `pnpm dev` holds port 1420 and stops `pnpm tauri dev` from starting (`strictPort`).
