# Contributing to SurfaceWeave

SurfaceWeave is an experimental protocol-first runtime. Contributions should
preserve the framework-neutral Protocol/Core boundary, trusted Component Pack
model, host-owned execution, and the decision not to implement a frontend
workflow engine.

## Development Setup

Use Node 22.13 or newer and pnpm 10.34.4:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

The root build is intentionally topological and serial because published type
entries resolve from each upstream package's `dist/` directory. Do not commit
generated `dist/`, `target/`, or coverage output.

## Tests and Release Gates

Add regression tests for behavior changes. Before opening a pull request, run:

```bash
pnpm verify:packages
pnpm audit:release
pnpm check:tauri
```

`verify:packages` packs the real npm artifacts and installs them in isolated
consumers. Changes to a manifest, export, peer dependency, protocol identity,
or wire value must update the release documentation and compatibility notes.

## Pull Requests

Keep changes scoped and explain the affected package boundaries. Include:

- the problem and intended behavior;
- verification commands and relevant test coverage;
- compatibility or security impact;
- screenshots for visible renderer or example changes.

Use concise imperative Conventional Commit subjects. Never bypass hooks with
`--no-verify`.
