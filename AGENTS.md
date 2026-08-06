# Repository Guidelines

## Project Structure & Module Organization

Architecture decisions live in `docs/`; the language-neutral contract and JSON Schema live in `protocol/`. Framework-independent TypeScript is under `packages/core`; generation, persistence, preferences, and Agent tools use their matching packages. React stays in `packages/renderer-react`; React Aria and Ant Design bindings are isolated in `packages/component-pack-*`. The desktop bridge remains in `packages/tauri`. Runnable acceptance flows are under `examples/`.

Place unit tests in each package's `tests/` directory and renderer assets beside their consuming package. Do not introduce React or host SDK dependencies into Core.

## Build, Test, and Development Commands

Use Node 22 (`nvm use 22`) and pnpm. Root commands are:

- `pnpm build` — build all packages and the Vite example.
- `pnpm typecheck` — type-check every workspace project in strict mode.
- `pnpm lint` — run ESLint and Prettier checks.
- `pnpm test` — run Vitest across package tests.
- `pnpm verify:packages` — pack publishable artifacts and test a clean consumer.
- `pnpm dev` — start the tea-purchase example.
- `pnpm dev:tauri` — start the Tauri 2 desktop example.
- `pnpm check:tauri` — compile-check the Rust host commands.
- `pnpm build:tauri` — produce the desktop release binary without broad host capabilities.

Update this guide and README when scripts or package boundaries change.

## Coding Style & Naming Conventions

Use TypeScript for shared protocols and runtime code. Keep core packages independent of React, Tauri, and agent SDKs. Follow two-space indentation, trailing commas where supported, and formatter output once configured. Use `PascalCase` for types and components (`ActionIntent`), `camelCase` for fields and functions (`baseRevision`), kebab-case for package directories, and dot-separated event names (`surface.created`). Prefer stable semantic identifiers over array indexes.

## Testing Guidelines

Vitest is the test runner; jsdom and Testing Library cover React. Name tests `*.test.ts` or `*.test.tsx`. Every bug fix needs a regression test. Test atomic failure, revision conflicts, data and preference migration, scope precedence, durable-write failures, shared views, and ActionIntent safety.

## Commit & Pull Request Guidelines

Use concise imperative Conventional Commit subjects, such as `feat(core): add surface operation`. Commit each completed change separately and never bypass hooks with `--no-verify`.

Pull requests should explain the problem, package boundaries affected, verification performed, and any protocol compatibility impact. Link related issues and include screenshots or recordings for renderer changes. Call out changes to `Surface`, `UIOperation`, or `ActionIntent` explicitly.
