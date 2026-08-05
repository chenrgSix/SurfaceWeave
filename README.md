# Package First Dynamic UI SDK

A package-first, framework-agnostic conversational UI runtime. JSON Schema and interaction intent produce a trusted declarative `Surface`; business Agents modify it through typed UI tools; renderers subscribe to the same `SurfaceStore`; host applications execute structured `ActionIntent` values.

Milestones 1–3 implement the in-memory runtime, deterministic generator, Agent tools, React renderer, storage adapters, durable preference patches, and a controlled Tauri 2 host bridge. The core package has no React, storage, or Tauri dependency.

## Packages

| Package                             | Responsibility                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@package-first/core`               | Protocol types, component allow-list, Surface Store, Operations, events, and ActionIntent validation |
| `@package-first/generator`          | Deterministic generation from a small JSON Schema subset                                             |
| `@package-first/agent-tools`        | Portable JSON Schema tool definitions, validation, and handlers                                      |
| `@package-first/preferences`        | Scoped preference composition, conflict detection, migration, and events                             |
| `@package-first/renderer-react`     | Trusted React implementations and shared Store rendering                                             |
| `@package-first/storage`            | LocalStorage, memory, and host-transport persistence adapters                                        |
| `@package-first/tauri`              | Allow-listed Tauri actions, Store-backed preferences, and capability descriptions                    |
| `@package-first/tea-purchase`       | Runnable Vite acceptance example                                                                     |
| `@package-first/tea-purchase-tauri` | Runnable Tauri 2 desktop acceptance example                                                          |

## Development

Use Node 22.13 or newer and pnpm 10:

```bash
nvm use 22
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm dev
```

`pnpm dev` starts the tea-purchase example. It demonstrates multi-selection, a validated ActionIntent, schema-generated purchase form, shared chat/workspace state, and Agent-driven layout changes that preserve entered data.

After installing the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), validate or run the desktop example with:

```bash
pnpm check:tauri
pnpm dev:tauri
# Release compilation without packaging an installer:
pnpm build:tauri --no-bundle
```

The desktop flow proves that Rust supplies tea results, both views share one Surface Store, Agent operations preserve form data, preferences survive through Tauri Store, session form values do not persist, and unknown semantic actions are rejected.

## Register Trusted Components

The Core definition controls which component names, bindings, and actions may enter a Surface. React implementations are registered separately.

```tsx
import { createStandardComponentRegistry } from "@package-first/core";
import {
  createStandardReactComponentRegistry,
  type RendererComponentProps,
} from "@package-first/renderer-react";

const components = createStandardComponentRegistry();
components.register({
  type: "TeaProductCard",
  binding: { valueTypes: ["string"], semantics: ["productId"] },
  actions: ["select", "preview"],
});

const reactComponents = createStandardReactComponentRegistry(components);
reactComponents.register("TeaProductCard", (props: RendererComponentProps) => {
  const value = typeof props.value === "string" ? props.value : null;
  return (
    <button onClick={() => props.onAction("select", { value })}>
      {String(props.node.props.label ?? "Tea")}
    </button>
  );
});
```

## Create and Render a Surface

```tsx
import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
} from "@package-first/core";
import { generateSurface } from "@package-first/generator";
import {
  SurfaceRenderer,
  createStandardReactComponentRegistry,
} from "@package-first/renderer-react";

const components = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(components);
store.createSurface(
  generateSurface(
    {
      surfaceId: "profile",
      intent: "form",
      schema: {
        type: "object",
        properties: { name: { type: "string", title: "Name" } },
      },
      data: { name: "Ada" },
    },
    components,
  ),
);

const reactComponents = createStandardReactComponentRegistry(components);

export function Profile() {
  return (
    <SurfaceRenderer
      surfaceId="profile"
      store={store}
      componentRegistry={components}
      reactComponents={reactComponents}
      onActionIntent={(intent) => hostActionExecutor.execute(intent)}
    />
  );
}
```

## Connect Agent Tool Calls

Pass `runtime.definitions()` to the host Agent SDK, then route returned calls through the host-neutral runtime. Invalid arguments and revision conflicts are returned as data.

```ts
import { AgentUIToolRuntime } from "@package-first/agent-tools";

const runtime = new AgentUIToolRuntime(components, store);
const definitions = runtime.definitions();

const result = runtime.execute(toolCall.name, JSON.parse(toolCall.arguments));
if (!result.ok) {
  console.error(result.error.code, result.error.message);
}
```

`ui.applyOperations` and `ui.replaceSurface` are session-only overrides: they update the Surface Store but never persist user preferences. Use the separate async preference runtime for confirmed long-term changes.

## Persist and Apply Preferences

Hydrate preferences before creating Surfaces, then pass the service into the Surface tool runtime. Preference operations target `stableId`, not generated node IDs or array indexes.

```ts
import type { PreferenceDocument } from "@package-first/core";
import {
  AgentUIToolRuntime,
  PreferenceAgentToolRuntime,
} from "@package-first/agent-tools";
import {
  PreferenceRepository,
  PreferenceService,
  parsePreferenceDocument,
} from "@package-first/preferences";
import { LocalStorageAdapter } from "@package-first/storage";

const adapter = new LocalStorageAdapter<PreferenceDocument>(
  "dynamic-ui.preferences.v1",
  parsePreferenceDocument,
);
const preferences = new PreferenceService(
  new PreferenceRepository(adapter),
  components,
);
await preferences.hydrate();

const surfaces = new AgentUIToolRuntime(components, store, preferences);
const preferenceTools = new PreferenceAgentToolRuntime(preferences);
```

For remote persistence, inject a host-owned transport into `BackendStorageAdapter`; the SDK never chooses an endpoint, credentials, or `fetch` policy. Long-term writes require `ui.savePreference` with `confirmed: true`. Applicable patches compose deterministically as `global` → `intent` → `tool`; developer hard constraints always win, while soft hints affect only default generation.

Choose persistence by host: `LocalStorageAdapter` for browser-only apps, `TauriPreferenceStorage` for a desktop app's official Store plugin, or `BackendStorageAdapter` for a host-owned service. Only versioned preference documents belong there—never Surface form data or Tool results.

When a schema changes, keep compatible `stableId` values. Supply `schemaRef` and `fieldAliases` during `ui.createSurface` for renamed fields. Aliases create an explicit conflict suggestion—they never silently rewrite durable preferences. Resolve with `ui.migratePreference` or remove with `ui.discardPreference`; subscribe to `preference.conflicted`, `preference.migrated`, and `preference.discarded` events for host UI feedback.

## Handle Actions

Renderer components emit JSON-only `ActionIntent` values. Route them to a host `ActionExecutor` that performs authorization, confirmation, idempotency, and network access; never place functions or source code in an intent.

In Tauri, register semantic host actions and let trusted handlers choose fixed Rust command names:

```ts
import { createTauriDynamicUIAdapter } from "@package-first/tauri";

const desktop = createTauriDynamicUIAdapter({
  preferenceNamespace: "tea-purchase",
  preferenceUserId: currentUser.id,
});

desktop.actionExecutor.register("tea.search", async ({ intent, invoke }) => ({
  status: "success",
  output: await invoke("search_teas", { query: intent.payload }),
}));
```

The security chain is: trusted component emits an `ActionIntent` → semantic action allow-list validates it → host handler selects a fixed command → Tauri capability authorizes that command → Rust validates the payload. A capability descriptor is UI discovery metadata, not authorization. The example grants only its two application commands and the Store operations it uses; it does not grant shell, filesystem, HTTP, or arbitrary command access, and its CSP permits only bundled assets, IPC, and the local Vite development endpoint.

See the [Milestone 3 summary](docs/milestone-3-summary.md), [Milestone 2 decisions](docs/milestone-2-decisions.md), [Milestone 1 decisions](docs/milestone-1-decisions.md), and the [architecture baseline](docs/dynamic-ui-architecture.md) for protocol boundaries and explicit non-goals.
