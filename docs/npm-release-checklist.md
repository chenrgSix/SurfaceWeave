# npm Release Candidate Checklist

## Release Candidate Version

All publishable packages are synchronized at `0.1.0-rc.1` and configured for
the `next` tag on the official npm registry. The wire protocol remains `1.0`;
npm package versions do not change Tool or Component Pack manifest versions.

If any package name already has a published version, derive its RC from that
package's highest published SemVer instead of publishing this candidate.

## Release Inventory

| Package                     | Workspace version | Publish tag |
| --------------------------- | ----------------: | ----------- |
| `@surfaceweave/protocol`    |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/core`        |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/storage`     |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/preferences` |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/generator`   |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/agent-tools` |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/react`       |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/react-aria`  |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/antd`        |        0.1.0-rc.1 | `next`      |
| `@surfaceweave/tauri`       |        0.1.0-rc.1 | `next`      |

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

- Every package declares MIT, includes an identical `LICENSE`, and records the
  canonical GitHub repository and package directory.
- Internal package dependencies use the exact prerelease range
  `0.1.0-rc.1`; the lockfile records the same suite version.
- Release metadata fixes the official registry, public access, and `next` tag.
- The protocol Schema uses the stable URN
  `urn:surfaceweave:schema:dynamic-ui-wire:1.0` and does not depend on domain
  ownership.
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

- confirm ownership of the `@surfaceweave` npm organization and availability
  of all ten package names on the official registry;
- confirm npm authentication and organization publish permissions without
  changing them from this repository task;
- grant explicit approval for the `0.1.0-rc.1` / `next` release.

## Publication Order

Publish in the order encoded by `scripts/release-packages.mjs`: Protocol, Core,
Storage, Preferences, Generator, Agent Tools, React, React Aria, Ant Design,
then Tauri. Each downstream package therefore resolves its exact RC dependency.

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
