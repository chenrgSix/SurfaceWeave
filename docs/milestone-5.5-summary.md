# Milestone 5.5 Summary

## Delivered

- Accepted ADR: this project will not implement a frontend workflow engine;
  current Surface and Invocation primitives remain the lightweight state model,
  with no `InteractionSession` abstraction.
- Audited ten publishable packages, dependency direction, framework boundaries,
  ESM exports, side effects, peer ranges, and npm metadata.
- Replaced publish-incompatible internal workspace ranges with SemVer while
  preserving local pnpm links.
- Added package READMEs, an explicit public API baseline, compatibility matrix,
  release inventory, metadata audit, and guarded `next` dry-run workflow.
- Reworked package verification around real `npm pack` tarballs and seven clean
  consumers covering protocol, Core, default React, React Aria, Ant Design,
  Tool-to-UI, and Tauri.

## Release Status

The Release Gate synchronized all packages at `0.1.0-rc.1`, repaired cold-build
ordering, adopted MIT across every tarball, fixed the official registry and
repository metadata, replaced the unowned Schema URL with a stable URN, and
added clean-checkout CI. Declaration validation now rejects executable values
and dangerous structure without rejecting inert text that resembles code.

All ten packages were published as `0.1.0-rc.1`. Post-publish validation found
that their Registry metadata, tarball integrity, dependencies, license, and
`gitHead` match the release commit. Promotion is blocked by a nested-array
result Surface defect and missing Git tag/GitHub Release; use a new RC rather
than overwriting the immutable npm version.

## Release Gate Verification

- Node `22.23.1` and pnpm `10.34.4`: frozen install, build, typecheck, lint,
  release metadata audit, and all 109 tests passed.
- A local clone containing no `dist/` directories completed frozen install and
  the dependency-ordered workspace build.
- Ten `npm pack` tarballs, including MIT licenses, installed successfully in
  seven isolated consumers covering Protocol, Core, all three React Packs,
  Tool-to-UI, and Tauri.
- Ten official-registry `npm publish --dry-run` checks passed; no package was
  published.
- `cargo check` and the Tauri release build with `--no-bundle` passed.
- The tea-purchase example was exercised in a real browser and its synchronized
  chat/workspace state is captured in the repository README.

The GitHub CI badge is passing. The Demo's deliberate multi-Pack preload and
the Ant Design-only chunk warning remain documented RC limitations. Future npm
releases use the protected Trusted Publishing workflow and require owner setup
before its first use.

## Explicit Non-goals

Milestone 5.5 added no workflow feature, `InteractionSession`, Renderer,
dynamic Pack downloading, or Vue/Flutter integration. Publication and
post-publish verification were handled as release operations only.
