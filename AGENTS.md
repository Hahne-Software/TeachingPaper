# TeachingPaper - desktop app for teaching material

- Multi-plattform (macOS, Linux, Windows) client desktop app
- Tauri as app framework
- Uses pnpm for dependency management
- Uses React with Typescript

## Commands

- use `pnpm tauri dev` to run the app locally
- `pnpm test` (Vitest) and `pnpm typecheck`; `pnpm format` fixes formatting. The pre-commit hook and CI run all three.

## Code style

- Use functional patterns where possible

## Branching & releases

- Trunk-based: `main` is always working and protected (PR + green CI required)
- Work in short-lived branches off `main`, merged via PR (squash): `feat/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`
- Commits follow Conventional Commits (`feat(app): ...`)
- Versioning: SemVer; keep version in sync in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- Release: bump version + changelog via PR, then tag the merge commit on `main` as `vX.Y.Z`; the tag push triggers the release build
- Only release commits are tagged, not every commit on `main`
