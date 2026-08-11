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

## RC.5 verification

RC.5 preserves every package entry point, peer range, and dependency boundary
listed above. The Generator root adds typed OpenAPI parameter-source policy;
Protocol and Core remain unchanged and framework-neutral. The tea-purchase
fixture's local reference resolver stays under the private example and is not
included in any public tarball.

Published tarballs verify that Host-owned header/cookie context does not enter
the canonical Tool Schema and that protected transport parameters cannot be
opted into user control. The existing eleven-consumer suite continues to prove
React-root isolation, independent Pack installation, DOM Driver lifecycle,
Vue/Agentdown integration, Tool Runtime usage, and Tauri bundling.

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

## RC.4 verification

RC.4 tarballs additionally verify the strict
`@surfaceweave/protocol/layout-schema` export, Core layout types/resolver, and
the React layout helpers through public entry points. The same Surface layout
is exercised by the framework-agnostic fake renderer and by the default,
React Aria, and Ant Design bindings. Core continues to compile with `ES2022`
only and has no DOM, React, Vue, Agentdown, CSS, or vendor type dependency.

These LayoutSpec additions are included in the published `0.1.0-rc.4` artifacts.

RC.4 tarballs also verify the standalone client-capability Protocol
exports, Core capability/action/resource types, Agent catalog projection, and
optional React Action state. Resource policy remains opt-in for compatibility.
The React root still loads without React DOM; the `./dom` consumer verifies
Action subscription cleanup on update and idempotent unmount. Framework-neutral
consumers compile the Core with no DOM library, and release audit rejects React,
Vue, Agentdown, DOM, component-library, or Tauri leakage into Protocol/Core.
