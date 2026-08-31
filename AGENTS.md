# Repository Guidelines

## Project Structure & Module Organization

Architecture decisions and the VitePress usage site live in `docs/`; the language-neutral Wire and Layout contracts plus JSON Schemas live in `protocol/`. Framework-independent TypeScript is under `packages/core`; generation, persistence, preferences, and Agent tools use their matching packages. React stays in `packages/renderer-react`; React Aria and Ant Design bindings are isolated in `packages/component-pack-*`. The desktop bridge remains in `packages/tauri`. Runnable acceptance flows are under `examples/`. `examples/operations-center` hosts the conversation playground by default and the original supply-chain flow at `?demo=operations`; its fixed dialogue templates, simulated Host, and trusted application Component Pack stay inside the example. The application shell is a separate Surface; no CSS or executable code enters Wire declarations. `examples/tea-purchase` remains the OpenAPI and multi-pack acceptance baseline.

The playground's dynamic page tool uses the real SDK `replaceSurface` path; it can regenerate registered display nodes but must preserve the visible shell/workspace identities and the separate business Surface. Custom palettes accept validated semantic hex colors only, never CSS code. Generated card/metric content is presentation, not authenticated business evidence.

The docs site hosts the standalone playground under `/SurfaceWeave/playground/`. Keep VitePress links as full-document navigation (`target="_self"`) so its SPA router does not capture the separate React app. GitHub Pages supplies static files only, no model proxy or shared credentials.

The playground's optional OpenAI-compatible browser client, ephemeral credentials, and model authorization policy belong only to the example. Expose UI operations only, never business execution tools or arbitrary code. Do not persist or log model credentials, and distinguish protocol fixtures from real-model acceptance.

Place unit tests in each package's `tests/` directory and renderer assets beside their consuming package. Do not introduce React or host SDK dependencies into Core.

## Build, Test, and Development Commands

Use Node 22 (`nvm use 22`) and pnpm. Root commands are:

- `pnpm build` — cold-build all packages in dependency-safe workspace order and build the Vite example.
- `pnpm typecheck` — type-check every workspace project in strict mode.
- `pnpm lint` — run ESLint and Prettier checks.
- `pnpm test` — run Vitest across package tests.
- `pnpm benchmark` — build Core and React, then run the reproducible Node/jsdom performance suite.
- `pnpm benchmark:smoke` — run the short benchmark wiring check used by CI.
- `pnpm benchmark:browser:install` — install the Chromium build used by the browser performance gate.
- `pnpm benchmark:browser` — run the production-build, single-worker Chromium benchmark.
- `pnpm verify:packages` — run `npm pack` and test isolated clean consumers.
- `pnpm audit:release` — audit release metadata, package boundaries, and tarball contents without registry access.
- `pnpm verify:release` — run the release audit and npm publish dry-runs against the official registry.
- `pnpm docs:dev` — start documentation-only VitePress development; run `pnpm dev` separately for the interactive app.
- `pnpm docs:build` — cold-build the demo SDK dependencies, build VitePress and the standalone app at `/SurfaceWeave/playground/`, then validate the combined Pages artifact.
- `pnpm docs:preview` — preview the combined documentation and playground deployment artifact.
- `pnpm dev` — build the flagship demo's SDK dependencies, then start the conversation playground at `127.0.0.1:5175`.
- `pnpm dev:tea` — start the original tea-purchase acceptance example.
- `pnpm dev:tauri` — start the Tauri 2 desktop example.
- `pnpm check:tauri` — compile-check the Rust host commands.
- `pnpm build:tauri` — produce the desktop release binary without broad host capabilities.

Update this guide and README when scripts or package boundaries change.

## Coding Style & Naming Conventions

Use TypeScript for shared protocols and runtime code. Keep core packages independent of React, Tauri, and agent SDKs. Layout declarations use Semantic LayoutSpec fields, never CSS, DOM, `className`, or vendor props. Follow two-space indentation, trailing commas where supported, and formatter output once configured. Use `PascalCase` for types and components (`ActionIntent`), `camelCase` for fields and functions (`baseRevision`), kebab-case for package directories, and dot-separated event names (`surface.created`). Prefer stable semantic identifiers over array indexes.

## Testing Guidelines

Vitest is the test runner; jsdom and Testing Library cover React. Name tests `*.test.ts` or `*.test.tsx`. Every bug fix needs a regression test. Test atomic failure, revision conflicts, data and preference migration, scope precedence, durable-write failures, shared views, semantic layout degradation, and ActionIntent safety.

CI pins npm 11.6.0 for clean-consumer verification because npm 10 can crash in circular optional peer resolution (`npm/cli#8448`). Reproduce locally without changing global npm using `npm exec --yes --package=npm@11.6.0 -- node scripts/verify-package-tarballs.mjs`. Keep peer validation enabled; do not bypass it with `--legacy-peer-deps` or `--force`.

## Commit & Pull Request Guidelines

Use concise imperative Conventional Commit subjects, such as `feat(core): add surface operation`. Commit each completed change separately and never bypass hooks with `--no-verify`.

Pull requests should explain the problem, package boundaries affected, verification performed, and any protocol compatibility impact. Link related issues and include screenshots or recordings for renderer changes. Call out changes to `Surface`, `UIOperation`, or `ActionIntent` explicitly.
