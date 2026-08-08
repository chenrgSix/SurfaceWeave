# Public API Baseline

## Status

This document freezes the `0.1.0-rc.3` candidate API surface. Only package entry
points declared in `exports` are public. Files under `src/` or `dist/`, relative
monorepo paths, test helpers, and example modules are internal and may change
without compatibility guarantees.

All JavaScript packages are ESM-only. `main`, `module`, and the default/import
conditions resolve to the same ESM entry; CommonJS is not claimed for this RC.

## Public Entry Points

| Package                     | Public entry points                                 |
| --------------------------- | --------------------------------------------------- |
| `@surfaceweave/protocol`    | `.`, `./schema`, `./component-pack`, `./tool-to-ui` |
| `@surfaceweave/core`        | `.`                                                 |
| `@surfaceweave/storage`     | `.`                                                 |
| `@surfaceweave/preferences` | `.`                                                 |
| `@surfaceweave/generator`   | `.`                                                 |
| `@surfaceweave/agent-tools` | `.`                                                 |
| `@surfaceweave/react`       | `.`, `./dom`                                        |
| `@surfaceweave/react-aria`  | `.`, `./styles.css`                                 |
| `@surfaceweave/antd`        | `.`                                                 |
| `@surfaceweave/tauri`       | `.`                                                 |

## Frozen Runtime Exports

- Core: action creation, Component/Tool registries, Surface and Invocation
  stores, Component Pack validation/resolution, Operations, migration, JSON
  validation, standard semantic components, and safe JSON/data helpers.
- Storage: memory, LocalStorage, backend transport adapters, codec, errors, and
  adapter types.
- Preferences: repository, service, hard-constraint checks, parsers, conflicts,
  migrations, and preference types.
- Generator: default, Tool input, and result Surface generators plus JSON
  Schema, Agent Tool, and OpenAPI adapters.
- Agent Tools: Surface, preference, and Tool-to-UI runtimes and JSON Schema tool
  definitions.
- React: `SurfaceRenderer`, `useSurface`, React component registry, default Pack,
  resolver validation, layout helper, and renderer types.
- React DOM: `createReactDOMRendererDriver` and its trusted host option type,
  available only from `@surfaceweave/react/dom`.
- React Aria and Ant Design: serializable manifest, Pack factory, and factory
  option types.
- Tauri: adapter factory, action executor, preference storage, capability
  provider, and their host-injection types.

The Core root also publicly exports its protocol types, including `Surface`,
`UINode`, `DataBinding`, `UIOperation`, `UIEvent`, `ActionIntent`,
`ToolDefinition`, `ToolInvocation`, `ToolSubmissionRequest`,
`ComponentPackManifest`, storage/preference records, and registry/store
interfaces.

Core also exports the optional, framework-neutral `SurfaceViewMode`,
`SurfaceViewReference`, `SurfaceViewHandle`, and
`SurfaceRendererDriver<TTarget>` types. `SurfaceViewReference` contains only a
Surface id and presentation mode; renderer capabilities, Pack policy, and
Action handling remain host configuration.

## Compatibility Policy

Adding an optional field or export is RC-compatible. Removing or renaming an
export, changing an accepted wire value, narrowing a peer range, or exposing a
new required subpath requires an explicit compatibility review. Wire protocol
version `1.0`, npm package versions, Tool versions, and Component Pack versions
remain separate version domains.

Clean-tarball type fixtures import every package only through these entry points
and verify that an internal Core subpath is rejected by Node package exports.
The React root is also loaded without `react-dom`; a separate tarball consumer
imports `@surfaceweave/react/dom`, and the Agentdown/Vue consumer uses only that
public subpath.
