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
- Editor tests (Tiptap Body Text, contenteditable Heading): read `docs/agents/testing-editors.md` first.
- Drag-and-drop tests: read `docs/agents/testing-dnd.md` first.
- Block Types or anything else saved in Worksheet Files: read `docs/format/worksheet-format.md` first; the spec, its XSD and examples change together with the code.

## Code style

- Use functional patterns where possible

## Branching & releases

- Trunk-based: `main` is always working and protected (PR + green CI required)
- Work in short-lived branches off `main`, merged via PR (squash): `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`
- Commits follow Conventional Commits (`feat(app): ...`)
- PR titles are Conventional Commits too (checked by `pr-title.yml`): the type becomes a label that sorts the PR into the release notes; scope `dev` (developer tooling) is left out of them
- Versioning: SemVer; bump with `pnpm version:set X.Y.Z` (updates `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`); CI fails via `pnpm version:check` if they drift
- Release: bump the version via PR (`chore(app): release X.Y.Z`), then tag the merge commit on `main` as `vX.Y.Z`. `release.yml` builds Linux/macOS/Windows installers on the tag push (named by `vX.Y.Z`) and creates a draft GitHub Release (publish it by hand). It also runs nightly when `main` has new commits and on demand (`gh workflow run release.yml`), named by short SHA; those builds are workflow artifacts only. Run it on demand to check `main` before tagging
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
