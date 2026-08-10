# npm Release Candidate Checklist

## Published Baseline and RC.4 Candidate

All ten publishable workspace packages are published as `0.1.0-rc.3` with npm
provenance. The official npm Registry resolves `next` to RC.3 and intentionally
keeps `latest` on the immutable RC.2 release. The wire protocol remains `1.0`;
npm package versions do not change Tool or Component Pack manifest versions.

The prepared candidate synchronizes all ten package manifests and exact
internal dependencies at `0.1.0-rc.4`. It is not published, tagged, or visible
through npm dist-tags yet.

## Release Inventory

| Package                     | Published | Candidate | Current public dist-tags             |
| --------------------------- | --------: | --------: | ------------------------------------ |
| `@surfaceweave/protocol`    |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/core`        |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/storage`     |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/preferences` |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/generator`   |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/agent-tools` |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/react`       |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/react-aria`  |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/antd`        |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |
| `@surfaceweave/tauri`       |      RC.3 |      RC.4 | `next` → RC.3, `latest` → 0.1.0-rc.2 |

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

## Candidate Metadata Checks

- Every package declares MIT, includes an identical `LICENSE`, and records the
  canonical GitHub repository and package directory.
- Internal package dependencies use the exact prerelease range
  `0.1.0-rc.4`; the lockfile records the same suite version.
- Release metadata fixes the official registry, public access, and `next` tag.
- The protocol Schema uses the stable URN
  `urn:surfaceweave:schema:dynamic-ui-wire:1.0` and does not depend on domain
  ownership.
- Explicit files, exports, ESM/default entry, types where applicable,
  side-effects, dependencies, peer ranges, and `publishConfig` are audited.
- Internal dependency ranges are npm-compatible SemVer, while pnpm links local
  workspace packages during development.
- Real `npm pack` tarballs install and type-check in eleven clean consumers,
  including React DOM and Agentdown/Vue lifecycle fixtures.
- Default React, React Aria, and Ant Design build independently without an
  unselected Pack installed.
- Tool-to-UI compiles/runs and the Tauri adapter type-checks/bundles from package
  root exports.
- `npm publish --dry-run --ignore-scripts --tag next --access public` succeeds
  for all ten packages and does not publish anything.

## Trusted Publishing Status

`0.1.0-rc.1` was published manually. RC.2 and RC.3 proved the protected OIDC
workflow documented in [npm Trusted Publishing](npm-trusted-publishing.md): all
ten packages expose verified provenance for the same tag, release commit, and
workflow run. Future releases must continue to:

- keep the same trusted publisher boundary for all ten packages;
- require review through the `npm-release` GitHub Environment;
- avoid restoring token-based publishing after OIDC verification;
- explicitly approve the exact version and annotated Git tag.

## Publication Order

Publish in the order encoded by `scripts/release-packages.mjs`: Protocol, Core,
Storage, Preferences, Generator, Agent Tools, React, React Aria, Ant Design,
then Tauri. Each downstream package therefore resolves its exact RC dependency.

The workflow delegates publication to `scripts/publish-release-packages.mjs`.
It packs each local artifact, compares npm integrity, skips an already-published
identical artifact, and refuses an immutable version whose integrity differs.
This allows a protected workflow retry to finish a partial suite safely.

## RC.4 Release Gate

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

The release workflow is the only repository path authorized to call real
`npm publish`; this checklist alone does not authorize a push, tag, npm
organization change, or release. Every future version still requires separate
owner approval before its tag is pushed.
