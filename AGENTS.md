# TeachingPaper - desktop app for teaching material

- Communication with agent in german, code, documentation, issues, PRs, specs and all other file in english
- Multi-platform (macOS, Linux, Windows) client desktop app
- Tauri as app framework
- Uses pnpm for dependency management
- Uses React with Typescript

## Commands

- use `pnpm tauri dev` to run the app locally
- `pnpm test` (Vitest), `pnpm typecheck` and `pnpm lint`; `pnpm format` fixes formatting. The pre-commit hook and CI run all of them.
- UI changes: verify in the browser against `pnpm dev` (port 1420) before reporting done, and read a WebKitGTK screenshot of each changed state; the Tauri shell is not needed. Read `docs/agents/browser-verification.md` first.
- Tiptap tests: read `docs/agents/testing-editors.md` first.
- Drag-and-drop tests: read `docs/agents/testing-dnd.md` first.

## Code style

- Use functional patterns where possible

## Branching & releases

- Trunk-based: `main` is always working and protected (PR + green CI required)
- Work in short-lived branches off `main`, merged via PR (squash): `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`
- Commits follow Conventional Commits (`feat(app): ...`)
- Versioning: SemVer; keep version in sync in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- Release: bump version + changelog via PR, then tag the merge commit on `main` as `vX.Y.Z`. `release.yml` builds Linux/macOS/Windows installers on every push to `main` (named by short SHA) and again on the tag push (named by `vX.Y.Z`); they are workflow artifacts
- Only release commits are tagged, not every commit on `main`

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`Hahne-Software/TeachingPaper`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Ideas

Start a message with `Neue Idee:` to capture an idea without touching code (skill `idea`). Ideas live in `docs/ideas/`; the `ideas-review` skill keeps the overview current and finds low-hanging fruits.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
