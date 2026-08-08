# RC.3 Release Summary

## Status

SurfaceWeave `0.1.0-rc.3` is published for all ten packages with npm provenance
and recorded as the GitHub prerelease
[`v0.1.0-rc.3`](https://github.com/chenrgSix/SurfaceWeave/releases/tag/v0.1.0-rc.3).
npm `next` resolves to RC.3; `latest` intentionally remains on the immutable
RC.2 release. The release adds only the accepted Milestone 6.1 Generic Renderer
Driver and its external-consumer validation; it does not start another feature
milestone.

## Additive Public API

- Core adds framework-neutral `SurfaceViewMode`, `SurfaceViewReference`,
  `SurfaceViewHandle`, and `SurfaceRendererDriver<TTarget>` types.
- `@surfaceweave/react/dom` adds `createReactDOMRendererDriver` using the
  optional `react-dom` peer. The React root entry remains independent of React
  DOM.
- Wire Protocol 1.0 is unchanged. No Vue Renderer, Agentdown Adapter, Web
  Component, workflow feature, or new Component Pack is included.

## Installation

Use the normal React entry in an existing React application:

```bash
npm install @surfaceweave/react@next
```

For Vue, Agentdown, Svelte, or another DOM host using the generic driver, add
React DOM and import the isolated subpath:

```bash
npm install @surfaceweave/react@next react-dom
```

```ts
import { createReactDOMRendererDriver } from "@surfaceweave/react/dom";
```

React and React DOM are host peer dependencies. React Aria and Ant Design remain
independently installable optional Packs.

## Candidate Evidence

All ten package manifests and exact internal dependency ranges are published as
`0.1.0-rc.3`. Tarball and Registry consumers verify the public `./dom` export,
declaration path, optional peer, React-root isolation, and Vite bundling. A real
Vue 3 plus Agentdown `0.0.5` consumer installs official Registry packages and
verifies chat/workspace Store sharing, bidirectional data, ActionIntent
delivery, Surface switching without a stale snapshot, and complete unmount
cleanup.

The protected
[release workflow](https://github.com/chenrgSix/SurfaceWeave/actions/runs/31266890720)
passed frozen install, cold build, typecheck, lint, 116 tests, ten clean tarball
consumers, release audit, Tauri checks, dependency-ordered OIDC publication,
and Registry artifact verification. Post-release validation independently
verified ten published tarballs, integrity, `gitHead`, dependencies, peers,
SLSA provenance, and all ten Registry consumers. The annotated release tag
continues to point to `e343a57`; this post-release documentation is a separate
commit on `main`.
