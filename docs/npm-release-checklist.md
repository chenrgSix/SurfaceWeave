# npm Release Candidate Checklist

## Proposed Version

No published npm release is recorded in this repository. If the `@surfaceweave`
scope confirms that these names have never shipped, use a synchronized first
suite version of `0.1.0-rc.1` and publish it under the `next` tag. Do not change
wire protocol `1.0` or Tool/Component Pack manifest versions when setting npm
package versions.

If any package name already has a published version, derive its RC from that
package's highest published SemVer instead of resetting it. Current workspace
versions are intentionally unchanged until release approval.

## Release Inventory

| Package                     | Current workspace version | RC proposal |
| --------------------------- | ------------------------: | ----------: |
| `@surfaceweave/protocol`    |                     0.4.0 |  0.1.0-rc.1 |
| `@surfaceweave/core`        |                     0.1.0 |  0.1.0-rc.1 |
| `@surfaceweave/storage`     |                     0.2.0 |  0.1.0-rc.1 |
| `@surfaceweave/preferences` |                     0.2.0 |  0.1.0-rc.1 |
| `@surfaceweave/generator`   |                     0.1.0 |  0.1.0-rc.1 |
| `@surfaceweave/agent-tools` |                     0.1.0 |  0.1.0-rc.1 |
| `@surfaceweave/react`       |                     0.1.0 |  0.1.0-rc.1 |
| `@surfaceweave/react-aria`  |                     0.4.0 |  0.1.0-rc.1 |
| `@surfaceweave/antd`        |                     0.4.0 |  0.1.0-rc.1 |
| `@surfaceweave/tauri`       |                     0.3.0 |  0.1.0-rc.1 |

## Package Name Migration

SurfaceWeave replaces the pre-release `@package-first` scope. Package
responsibilities and public exports stay unchanged; the React-facing package
names are shortened at the public boundary:

- `@package-first/renderer-react` becomes `@surfaceweave/react`;
- `@package-first/component-pack-react-aria` becomes `@surfaceweave/react-aria`;
- `@package-first/component-pack-antd` becomes `@surfaceweave/antd`;
- all other publishable packages retain their suffix under `@surfaceweave`.

No compatibility aliases are required because this repository records no
published release under the previous names. Reassess that assumption before a
real publish.

## Completed Checks

- Explicit files, exports, ESM/default entry, types where applicable,
  side-effects, dependencies, peer ranges, and `publishConfig` are audited.
- Internal dependency ranges are npm-compatible SemVer, while pnpm links local
  workspace packages during development.
- Real `npm pack` tarballs install and type-check in seven clean consumers.
- Default React, React Aria, and Ant Design build independently without an
  unselected Pack installed.
- Tool-to-UI compiles/runs and the Tauri adapter type-checks/bundles from package
  root exports.
- `npm publish --dry-run --ignore-scripts --tag next --access public` succeeds
  for all ten packages and does not publish anything.

## Blocking Owner Decisions

Do not perform a real publish until all items are resolved:

- choose a public license and replace `UNLICENSED` plus add the license file;
- provide the canonical Git repository URL for every package's `repository`
  metadata;
- confirm ownership and availability of the `@surfaceweave` npm scope/names;
- confirm the intended registry. The dry-run observed the developer's current
  `https://registry.npmmirror.com/` configuration; this repository did not
  modify npm account, organization, authentication, or registry settings;
- approve the package versions and `next` tag.

## Commands After Approval

Before any real publish, start from a clean commit and rerun:

```bash
nvm use 22
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm verify:packages
pnpm verify:release
pnpm check:tauri
pnpm build:tauri --no-bundle
```

This checklist does not authorize `npm publish`, Git push, a PR, a tag, a
GitHub Release, or npm account/organization changes.
