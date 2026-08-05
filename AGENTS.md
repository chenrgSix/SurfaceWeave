# Repository Guidelines

## Project Structure & Module Organization

This repository is currently design-first. Architecture decisions live in `docs/`, with `docs/dynamic-ui-architecture.md` defining the package boundaries and core protocols. Keep design proposals and decision records in that directory.

When implementation begins, use a workspace under `packages/`. Keep the framework-independent runtime in `packages/dynamic-ui-core`, generation in `packages/dynamic-ui-generator`, React rendering in `packages/dynamic-ui-react`, and host integrations in adapter packages. Place tests beside their code or in each package's `tests/` directory. Static assets belong to the renderer package that consumes them.

## Build, Test, and Development Commands

No package manifest or executable toolchain is committed yet. Do not present untracked local commands as project requirements. After the workspace is scaffolded, expose consistent root scripts such as:

- `npm run build` — build all workspace packages in dependency order.
- `npm test` — run the complete automated test suite.
- `npm run lint` — check TypeScript and Markdown style.
- `npm run dev` — start the React example or development playground.

Update this guide and the root README when these commands become available. Use Node 22 when required (`nvm use 22`).

## Coding Style & Naming Conventions

Use TypeScript for shared protocols and runtime code. Keep core packages independent of React, Tauri, and agent SDKs. Follow two-space indentation, trailing commas where supported, and formatter output once configured. Use `PascalCase` for types and components (`ActionIntent`), `camelCase` for fields and functions (`baseRevision`), kebab-case for package directories, and dot-separated event names (`surface.created`). Prefer stable semantic identifiers over array indexes.

## Testing Guidelines

Add unit tests for protocol validation, revision conflicts, data migration, and deterministic UI generation. Renderer tests should cover bindings, actions, and state preservation. Name tests `*.test.ts` or `*.test.tsx`. Every bug fix should include a regression test; side-effecting actions must test confirmation, authorization, and idempotency behavior.

## Commit & Pull Request Guidelines

Because no Git history is available in this checkout, use concise imperative commit subjects, optionally scoped, such as `docs: clarify surface revision rules`. Commit each completed change separately and never bypass hooks with `--no-verify`.

Pull requests should explain the problem, package boundaries affected, verification performed, and any protocol compatibility impact. Link related issues and include screenshots or recordings for renderer changes. Call out changes to `Surface`, `UIOperation`, or `ActionIntent` explicitly.
