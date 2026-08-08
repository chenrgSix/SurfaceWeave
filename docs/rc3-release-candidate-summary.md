# RC.3 Candidate Summary

## Status

SurfaceWeave `0.1.0-rc.3` is prepared but not tagged or published. RC.2 remains
immutable on npm `next` and `latest` until explicit release approval. This
candidate adds only the accepted Milestone 6.1 Generic Renderer Driver and its
external-consumer validation; it does not start another feature milestone.

## Additive Public API

- Core adds framework-neutral `SurfaceViewMode`, `SurfaceViewReference`,
  `SurfaceViewHandle`, and `SurfaceRendererDriver<TTarget>` types.
- `@surfaceweave/react/dom` adds `createReactDOMRendererDriver` using the
  optional `react-dom` peer. The React root entry remains independent of React
  DOM.
- Wire Protocol 1.0 is unchanged. No Vue Renderer, Agentdown Adapter, Web
  Component, workflow feature, or new Component Pack is included.

## Installation After Publication

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

All ten package manifests and exact internal dependency ranges are synchronized
to `0.1.0-rc.3`. Tarball consumers verify the public `./dom` export, declaration
path, optional peer, React-root isolation, and Vite bundling. A real Vue 3 plus
Agentdown `0.0.5` consumer installs generated SurfaceWeave tarballs and verifies
chat/workspace Store sharing, bidirectional data, ActionIntent delivery,
Surface switching without a stale snapshot, and complete unmount cleanup.

The candidate passed frozen install, cold build, typecheck, lint, 116 tests,
ten clean tarball consumers, release audit, ten npm publish dry-runs, eight
current RC.2 Registry consumers, documentation build, Tauri Cargo check, and a
no-bundle Tauri release build. The two RC.3-only Registry fixtures are skipped
until `next` is promoted; their equivalent tarball fixtures passed. No RC.3
tag, GitHub Release, or npm publication is part of candidate preparation.
