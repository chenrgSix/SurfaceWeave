# npm Compatibility Matrix

| Package                     | Runtime boundary                    | Required peers or host                                    | Verified environment                                                                      |
| --------------------------- | ----------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `@surfaceweave/protocol`    | JSON/docs only                      | None                                                      | Node JSON import; language-neutral Schema                                                 |
| `@surfaceweave/core`        | Framework-agnostic ESM              | None                                                      | Node 22, strict CSP, no DOM lib                                                           |
| `@surfaceweave/storage`     | Framework-agnostic ESM              | Browser only for `LocalStorageAdapter`                    | Node 22 and browser build                                                                 |
| `@surfaceweave/preferences` | Framework-agnostic ESM              | Core and Storage                                          | Node 22                                                                                   |
| `@surfaceweave/generator`   | Framework-agnostic ESM              | Core                                                      | Node 22                                                                                   |
| `@surfaceweave/agent-tools` | Framework-agnostic ESM              | Core, Generator, Preferences, Storage                     | Node 22                                                                                   |
| `@surfaceweave/react`       | React binding + optional DOM driver | React `>=18.2 <20`; optional React DOM for `./dom`        | Root without React DOM; `./dom` with React 19.2/DOM, Vue 3.5, Agentdown 0.0.5, and Vite 8 |
| `@surfaceweave/react-aria`  | Optional React Pack                 | React/DOM `>=18.2 <20`, React Aria Components `>=1.20 <2` | React 19.2, RAC 1.20, Vite 8                                                              |
| `@surfaceweave/antd`        | Optional React Pack                 | React/DOM `>=18.2 <20`, Ant Design `>=6.5.3 <7`           | React 19.2, AntD 6.5, Vite 8                                                              |
| `@surfaceweave/tauri`       | Optional Tauri 2 host adapter       | Tauri API `^2.8`, Store plugin `^2.4`                     | Clean TypeScript/Vite consumer, Cargo check, macOS Tauri release build                    |

TypeScript 6.0 is the verified declaration consumer. Windows/Linux Tauri
packaging, CommonJS, React 20, Ant Design 7, React Aria 2, and older TypeScript
versions are not claimed by this RC.

The `@surfaceweave/react` root consumer is verified without `react-dom`
installed. A separate clean consumer imports `@surfaceweave/react/dom`, mounts
through `createReactDOMRendererDriver`, and bundles React DOM without pulling in
React Aria or Ant Design.

A second tarball-only consumer uses Agentdown `0.0.5` inside a Vue 3 app. Its
controlled Vue component accepts only `surfaceId`, mounts the same driver in an
Agentdown chat block, and shares one Store with a workspace view. The test
covers bidirectional input, ActionIntent forwarding, Surface switching,
idempotent teardown, subscription release, and production bundling. Agentdown,
Vue, React, and React DOM remain consumer dependencies and do not appear in
Core or unrelated release packages.

## Pack Isolation Evidence

Each Vite build used tarballs in a clean project where unselected Packs were not
installed:

| Consumer      | Installed Pack                   | Minified JS |
| ------------- | -------------------------------- | ----------: |
| React default | none beyond the default renderer |    48.37 kB |
| React Aria    | React Aria only                  |   341.58 kB |
| Ant Design    | Ant Design only                  | 1,052.63 kB |

Default and React Aria remain below Vite's 500 kB warning threshold. Ant Design
alone exceeds it; the other Packs are physically absent, so this is AntD cost,
not cross-Pack leakage. The tea demo intentionally imports three selectable
Packs and therefore remains larger. Runtime Pack downloading is not part of
this release.

## Current main: unreleased LayoutSpec verification

Local candidate tarballs additionally verify the strict
`@surfaceweave/protocol/layout-schema` export, Core layout types/resolver, and
the React layout helpers through public entry points. The same Surface layout
is exercised by the framework-agnostic fake renderer and by the default,
React Aria, and Ant Design bindings. Core continues to compile with `ES2022`
only and has no DOM, React, Vue, Agentdown, CSS, or vendor type dependency.

These LayoutSpec additions require a later release candidate and are not
claimed for the published `0.1.0-rc.3` artifacts in the table above.
