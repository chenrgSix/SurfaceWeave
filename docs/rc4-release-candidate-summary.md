# RC.4 Release Candidate Summary

## Status

SurfaceWeave `0.1.0-rc.4` is prepared for all ten public packages. This is a
local candidate only: no tag, GitHub Release, or npm publication exists yet.
npm `next` continues to resolve to RC.3 and `latest` remains on RC.2 until a
separately approved protected release succeeds.

## Included changes

### Semantic LayoutSpec 1.0

- standalone protocol document and JSON Schema at
  `@surfaceweave/protocol/layout` and `./layout-schema`;
- portable columns, gap, alignment, span, and compact/workspace overrides;
- deterministic form Sections and developer soft hints without changing
  `stableId`, DataBinding, or Surface data;
- consistent fallback in the default React, React Aria, Ant Design, and
  framework-agnostic fake renderers.

### Capabilities, Action State, and resources

- a host-generated, JSON-only capability handshake at
  `@surfaceweave/protocol/client-capabilities` and
  `./client-capabilities-schema`;
- shared trusted catalog projection for `ui.inspectComponentPacks`;
- ToolInvocation-backed read-only Action state, non-Tool Action execution,
  pending-call coalescing, retry/cancel projection, and a host-only interaction
  gate;
- optional Action state support in `SurfaceRenderer`, existing Component Pack
  bindings, and `@surfaceweave/react/dom`;
- opt-in `SurfaceResourcePolicy` enforcement before Surface create, replace,
  data update, and Operation commits.

### Runtime and release hardening

- preflighted Invocation identity/state transitions and listener isolation;
- explicit Store/Runtime disposal and observer-error reporting;
- dependency-ordered release publication that safely resumes only when an
  existing immutable Registry artifact has identical integrity.

## Compatibility

Wire Protocol remains version `1.0`; the new protocol documents and manifest
fields are optional and additive. Core remains independent of React, DOM,
Tauri, Vue, Agentdown, and network libraries. React DOM remains an optional
peer used only by `@surfaceweave/react/dom`; React Aria and Ant Design remain
independently installable Packs.

Existing Store construction keeps RC.3 numeric acceptance behavior unless the
host explicitly supplies `resourcePolicy`. Deprecated resource-limit aliases
remain exported. Existing React Component Packs may ignore the new optional
Action props. The intentional behavior change is that a duplicate Tool submit
while pending now returns the same pending outcome and emits one Host request
instead of throwing.

## Installation after publication

```bash
npm install @surfaceweave/core@next \
  @surfaceweave/generator@next \
  @surfaceweave/agent-tools@next
```

React hosts add `@surfaceweave/react@next`. DOM Driver hosts also install
`react-dom` and import `@surfaceweave/react/dom`. Do not use these commands to
test RC.4 before publication; during candidate review, use the generated local
tarballs from `pnpm verify:packages`.

## Candidate evidence

The prepared suite uses exact `0.1.0-rc.4` internal dependencies and a matching
lockfile. Under Node 22, the candidate passes frozen install, cold build,
typecheck, lint, 36 Vitest files / 152 tests, ten package tarballs / eleven clean
consumers, all ten npm publish dry-runs, VitePress build, Tauri cargo check, and
the optimized no-bundle Tauri build.

Known Vite large-chunk warnings remain limited to the demo, Ant Design itself,
and the Agentdown consumer. Package isolation tests confirm they are not caused
by unselected Component Packs leaking into ordinary consumers.

## Release boundary

Publishing still requires explicit confirmation of the final clean commit.
Only then may that exact commit receive annotated tag `v0.1.0-rc.4`, be pushed,
and enter the protected `npm-release` Environment for OIDC Trusted Publishing.
The release must update only `next`; `latest` remains unchanged unless the owner
separately authorizes it.
