# RC.2 Release Candidate Summary

## Outcome

SurfaceWeave `0.1.0-rc.2` is prepared and verified locally but has not been
published. This candidate fixes the RC.1 Tool-to-UI blocker where nested
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

## Release Gate

Before publishing, the owner must configure npm Trusted Publishing for all ten
packages and required reviewers on the `npm-release` GitHub Environment. Then
push the reviewed commits, create the approved annotated `v0.1.0-rc.2` tag, and
use the protected release workflow. The current npm `next` version remains
`0.1.0-rc.1`; no tag, GitHub Release, push, or npm publication was performed as
part of this preparation.

The existing Vite demo and isolated Ant Design chunk warnings remain known,
non-blocking package-size observations.
