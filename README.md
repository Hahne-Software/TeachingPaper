# TeachingPaper

A desktop editor in which teachers compose worksheets for students out of predefined content blocks.

> **Status: early development (0.1.x).** The editor works, but features such as PDF export and saving are not implemented yet.

## Features

- Compose a worksheet from blocks: headings (three levels) and body text with bold, italic and underline
- Add blocks from the block palette by click or drag and drop, and reorder them by dragging
- Edit the settings of the selected block in the properties panel
- Live A4 pagination: blocks move whole to the next page when they no longer fit
- Runs on Linux, macOS and Windows

## Installation

Installers for Linux, macOS and Windows are attached to the [GitHub Releases](https://github.com/Hahne-Software/TeachingPaper/releases).

The installers are not code-signed yet, so macOS (Gatekeeper) and Windows (SmartScreen) show a warning on first start.

## Development

Built with [Tauri](https://tauri.app), React and TypeScript, using [pnpm](https://pnpm.io). The repository ships a Nix flake (`nix develop`) with all system dependencies.

```sh
pnpm install
pnpm tauri dev   # run the desktop app
pnpm dev         # frontend only, in the browser on port 1420
pnpm test        # unit tests (Vitest)
pnpm typecheck
pnpm lint
pnpm format      # fix formatting
```

Domain terms are defined in [GLOSSARY.md](GLOSSARY.md), architecture decisions live in [docs/adr](docs/adr), and product ideas in [docs/ideas](docs/ideas). Contribution rules for humans and agents are in [AGENTS.md](AGENTS.md).

## License

[EUPL-1.2](LICENSE)
