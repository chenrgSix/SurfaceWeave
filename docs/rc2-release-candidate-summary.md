# RC.2 Release Summary

## Outcome

SurfaceWeave `0.1.0-rc.2` is published on npm and recorded as the GitHub
prerelease `v0.1.0-rc.2`. It fixes the RC.1 Tool-to-UI blocker where nested
object and array result nodes could receive the same identity and fail Surface
validation.

## Changes

- Result nodes now use deterministic, role-qualified IDs for roots, groups,
  values, states, and actions.
- Structural group nodes use a namespaced `ui.group:` stable ID, while bound
  value nodes retain their semantic result path and `DataBinding`.
- Generator and end-to-end Tool Runtime tests cover a nested tea array result.
- All ten public packages and exact internal dependencies are synchronized at
  `0.1.0-rc.2`; the lockfile and release automation use the same version.

No product feature, workflow behavior, renderer, or protocol change was added.

## Verification

The workspace and a new clone without prebuilt `dist/` directories passed on
Node `22.23.1` and pnpm `10.34.4`:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm verify:packages
pnpm audit:release
pnpm verify:release
pnpm check:tauri
pnpm build:tauri --no-bundle
```

Results: 27 Vitest files and 111 tests passed; ten tarballs and seven isolated
consumers passed; all ten official-Registry publish dry-runs passed; Tauri
`cargo check` and the optimized no-bundle build passed. One clean-consumer run
encountered a transient npm `ECONNRESET`; an unchanged retry passed.

## Published Artifacts

The protected Trusted Publishing workflow published all ten packages with npm
provenance. The annotated `v0.1.0-rc.2` tag, package `gitHead`, and provenance
all resolve to commit `860c7e5e128c8f30b89dc2d0a8ccac6d54b27cf8` and
[workflow run 31196235870](https://github.com/chenrgSix/SurfaceWeave/actions/runs/31196235870).
The matching [GitHub prerelease](https://github.com/chenrgSix/SurfaceWeave/releases/tag/v0.1.0-rc.2)
exists without moving or rebuilding the tag.

Post-release cleanup keeps `next` on `0.1.0-rc.2` and moves `latest` from the
defective RC.1 to the same RC.2. Removing `latest` would make an unqualified
`npm install @surfaceweave/core` fail, so both tags intentionally resolve to
one usable release candidate. Every published tarball contains its package
README and canonical MIT license.

The existing Vite demo and isolated Ant Design chunk warnings remain known,
non-blocking package-size observations.
