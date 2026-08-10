# Public API Baseline

## Status

This document freezes the prepared `0.1.0-rc.4` candidate API surface. The
candidate is not published; npm `next` still serves RC.3. Only package entry
points declared in `exports` are public. Files under `src/` or `dist`, relative
monorepo paths, test helpers, and example modules are internal and may change
without compatibility guarantees.

All JavaScript packages are ESM-only. `main`, `module`, and the default/import
conditions resolve to the same ESM entry; CommonJS is not claimed for this RC.

## Public Entry Points

| Package                     | Public entry points                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@surfaceweave/protocol`    | `.`, `./schema`, `./component-pack`, `./tool-to-ui`, `./layout`, `./layout-schema`, `./client-capabilities`, `./client-capabilities-schema` |
| `@surfaceweave/core`        | `.`                                                                                                                                         |
| `@surfaceweave/storage`     | `.`                                                                                                                                         |
| `@surfaceweave/preferences` | `.`                                                                                                                                         |
| `@surfaceweave/generator`   | `.`                                                                                                                                         |
| `@surfaceweave/agent-tools` | `.`                                                                                                                                         |
| `@surfaceweave/react`       | `.`, `./dom`                                                                                                                                |
| `@surfaceweave/react-aria`  | `.`, `./styles.css`                                                                                                                         |
| `@surfaceweave/antd`        | `.`                                                                                                                                         |
| `@surfaceweave/tauri`       | `.`                                                                                                                                         |

The Protocol layout and client-capability subpaths are new in the RC.4
candidate and are absent from published RC.3.

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
  resolver validation, `safeLayoutStyle`, `safeLayoutItemStyle`, and renderer
  types.
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

## RC.4 Semantic LayoutSpec 1.0

The candidate adds:

- Protocol exports the human-readable `./layout` contract and the strict
  `./layout-schema` JSON Schema;
- Core exports `SemanticLayout`, its value/feature/diagnostic types,
  `semanticLayoutFeatures`, `parseSemanticLayout`, `serializeSemanticLayout`,
  and `resolveSemanticLayout`;
- `ComponentManifest` and `ComponentDefinition` add optional
  `layoutCapabilities`;
- the standard semantic catalog adds `Section`;
- Generator soft hints add root/field layout and explicit group metadata;
- React exports `safeLayoutItemStyle` in addition to the compatible
  `safeLayoutStyle` helper.

`UINode.layout` intentionally remains `Record<string, JsonValue>` so Wire
Protocol 1.0 consumers are not narrowed. Generator and Agent Tool output use
the stricter portable subset; renderers diagnose and ignore legacy unknown
properties instead of forwarding them to framework sinks.

## RC.4 Capability, Action State, and Resource Policy

The candidate adds:

- Protocol exports language-neutral client capability documentation and a
  Draft 2020-12 JSON Schema;
- Core exports `SurfaceClientCapabilities`, shared catalog projection helpers,
  `ActionExecutionStateSource`, `InMemoryActionExecutionController`,
  `SurfaceResourcePolicy`, its recommended/resolve/assert/summary helpers,
  `InMemorySurfaceStoreOptions`, and observer error types;
- `InMemorySurfaceStore` accepts opt-in `resourcePolicy` and observer-error
  options, exposes a policy summary, and has an idempotent `dispose()` method;
- Agent Tools exports `ToolToUIRuntimeOptions` and
  `ToolRuntimeListenerErrorHandler`; `AgentUIToolRuntime` accepts trusted client
  capability options; `ToolToUIRuntime` adds a ToolInvocation-backed
  `actionStateSource`, host-only `setInteractionDisabled()`,
  `disposeInvocation()`, and `dispose()`;
- React `SurfaceRenderer`, `RendererComponentProps`, and the `./dom` Driver add
  optional read-only Action state without adding React DOM to the root entry.

These APIs bound untrusted payload work, isolate observer failures from
committed state, and release Runtime-owned subscriptions. Numeric resource
limits are opt-in, so the existing RC.3 Store constructor retains its accepted
payload range. Deprecated `SurfaceResourceLimits`, `limits`, and legacy helper
names remain available for source compatibility. These additions become
Registry-installable only after the protected RC.4 publication succeeds.

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
