# TeachingPaper - desktop app for teaching material

- Multi-plattform (macOS, Linux, Windows) client desktop app
- Tauri as app framework
- Uses pnpm for dependency management
- Uses React with Typescript

## Commands
- use `pnpm tauri dev` to run the app locally

## Code style
- TypeScript strict mode
- Single quotes, semicolons
- Use functional patterns where possible

## Branching & releases
- Trunk-based: `main` is always working and protected (PR + green CI required)
- Work in short-lived branches off `main`, merged via PR (squash): `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`
- Commits follow Conventional Commits (`feat(app): ...`)
- Versioning: SemVer; keep version in sync in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- Release: bump version + changelog via PR, then tag the merge commit on `main` as `vX.Y.Z`; the tag push triggers the release build
- Only release commits are tagged, not every commit on `main`

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (`Hahne-Software/TeachingPaper`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
