# SurfaceWeave

[![CI](https://github.com/chenrgSix/SurfaceWeave/actions/workflows/ci.yml/badge.svg)](https://github.com/chenrgSix/SurfaceWeave/actions/workflows/ci.yml)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-6655e8.svg)](https://chenrgsix.github.io/SurfaceWeave/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status: experimental RC](https://img.shields.io/badge/status-0.1.0--rc.4-orange.svg)

**SurfaceWeave — A protocol-first runtime for agent-generated, tool-driven UI.**

面向 Agent 动态生成与调整业务 UI 的协议优先运行时。

> **Status:** all ten packages are published as experimental `0.1.0-rc.4` with
> npm provenance. npm `next` resolves to RC.4, while `latest` intentionally
> remains on immutable RC.2. Review the
> [RC.4 release summary](docs/rc4-release-candidate-summary.md) before use.

JSON Schema and interaction intent produce a trusted declarative `Surface`; business Agents modify it through typed UI tools; renderers subscribe to the same `SurfaceStore`; host applications execute structured `ActionIntent` values.

Milestones 1–6.3 implement the Surface runtime, deterministic Tool Schema generation, Tool invocation lifecycle, Agent tools, preferences, controlled Tauri bridge, language-neutral protocols, generic Renderer Driver, Semantic LayoutSpec, capability handshake, Action state projection, and resource policy. The same semantic Surface can use the default React, React Aria, or Ant Design binding without changing its data. Core has no React, DOM, network-library, component-library, or Tauri dependency.

RC.4 adds Semantic LayoutSpec 1.0, deterministic form sections,
strict Agent layout tools, a host-generated capability handshake, unified
read-only Action state, and opt-in Surface resource policy. These APIs are
available from npm through the `next` dist-tag.

SurfaceWeave is inspired by the event-stream ideas in AG-UI and the
declarative component-tree ideas in A2UI, but is not protocol-compatible with
either project.

## Documentation

Read the [SurfaceWeave usage guide](https://chenrgsix.github.io/SurfaceWeave/)
for installation, Tool-to-UI setup, React rendering, Component Packs,
generic DOM-host mounting, preferences, storage, and Tauri integration. Documentation source lives in
`docs/`; run `pnpm docs:dev` to preview it locally.

![Tea purchase Tool-to-UI demo](docs/assets/tea-purchase-demo.jpg)

## SurfaceWeave in 30 Seconds

1. A business Agent or backend selects a registered Tool and may adjust its
   generated semantic Surface through typed UI tools.
2. SurfaceWeave validates and renders the Surface, retains interaction data,
   and emits structured `ActionIntent` values.
3. The host-owned executor authorizes side effects, invokes business APIs, and
   returns a result or the next Surface. SurfaceWeave does not run workflows.

## Three-Step Quick Start

```bash
nvm use 22
pnpm install --frozen-lockfile
pnpm dev
```

Open the Vite URL printed by the final command. The example runs entirely with
mock Tool results and a mock Host executor.

## Packages

| Package                            | Responsibility                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@surfaceweave/core`               | Wire types, Tool/Component registries, Surface and Invocation stores, Operations, and validation |
| `@surfaceweave/generator`          | Deterministic input/result Surfaces from JSON Schema and canonical Tool Definitions              |
| `@surfaceweave/agent-tools`        | Tool-to-UI orchestration and portable Agent UI tool definitions                                  |
| `@surfaceweave/preferences`        | Scoped preference composition, conflict detection, migration, and events                         |
| `@surfaceweave/react`              | Trusted React implementations and shared Store rendering                                         |
| `@surfaceweave/protocol`           | Standalone Wire/Layout JSON Schemas and language-neutral Component Pack specifications           |
| `@surfaceweave/react-aria`         | Accessible React Aria runtime bindings and styles                                                |
| `@surfaceweave/antd`               | Ant Design runtime bindings and ConfigProvider theme integration                                 |
| `@surfaceweave/storage`            | LocalStorage, memory, and host-transport persistence adapters                                    |
| `@surfaceweave/tauri`              | Allow-listed Tauri actions, Store-backed preferences, and capability descriptions                |
| `@surfaceweave/tea-purchase`       | Runnable Vite acceptance example                                                                 |
| `@surfaceweave/tea-purchase-tauri` | Runnable Tauri 2 desktop acceptance example                                                      |

## npm Installation

Install only the layers used by the host:

```bash
# Framework-independent Tool-to-UI runtime
npm install @surfaceweave/core@next @surfaceweave/generator@next @surfaceweave/agent-tools@next

# Existing React application (React is a peer dependency)
npm install @surfaceweave/react@next

# Generic DOM Driver (add React DOM explicitly)
npm install @surfaceweave/react@next react-dom

# Choose zero or one optional third-party Pack
npm install react-aria-components @surfaceweave/react-aria@next
# or
npm install antd @surfaceweave/antd@next

# Optional Tauri 2 host adapter
npm install @surfaceweave/storage@next @surfaceweave/preferences@next @surfaceweave/tauri@next
```

The Protocol and Core packages never install React, DOM bindings, a Component
Pack, or Tauri. Installing the default renderer does not install React Aria or
Ant Design.

Vue, Svelte, Agentdown, and plain DOM hosts do not need dedicated SurfaceWeave
Adapter packages. Install `@surfaceweave/react@next` with `react-dom`, then
import `createReactDOMRendererDriver` from `@surfaceweave/react/dom`; the
trusted host injects the Store, registries, Pack policy, capabilities, and
ActionIntent handler once, while each mounted view supplies only `surfaceId`
and mode. The `./dom` entry first appears in RC.3 and is unavailable from the
older RC.2 release.

## Development

Use Node 22.13 or newer and pnpm 10:

```bash
nvm use 22
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm verify:packages
pnpm verify:release
pnpm docs:dev
pnpm docs:build
pnpm dev
```

`pnpm dev` starts the tea-purchase flow. Submit the generated search form, select products, fill the purchase form, confirm the side effect, and inspect the result. Switch among `default`, `react-aria`, and `antd`; chat and workspace retain one Surface Store. `pnpm verify:packages` also installs the Tool Runtime from tarballs in a clean consumer.

After installing the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), validate or run the desktop example with:

```bash
pnpm check:tauri
pnpm dev:tauri
# Release compilation without packaging an installer:
pnpm build:tauri --no-bundle
```

The desktop flow reuses the Web Tool Definitions, data model, intents, and mock Host executor while retaining Tauri Store preferences. It supports the default and Ant Design Packs; session form values and Tool results are not persisted.

## Register and Execute Tools

The host registers serializable definitions. The Runtime generates input UI and emits a request after validation and any mandatory confirmation; it never calls the business API.

```ts
import {
  AgentUIToolRuntime,
  ToolToUIRuntime,
  type ToolExecutionError,
} from "@surfaceweave/agent-tools";
import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  recommendedSurfaceResourcePolicy,
  type ToolHostExecutor,
} from "@surfaceweave/core";

const components = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(components, {
  resourcePolicy: recommendedSurfaceResourcePolicy,
});
const runtime = new ToolToUIRuntime(components, store);
const hostExecutor: ToolHostExecutor = {
  async execute(request) {
    // Perform host authorization and call the registered business API here.
    return { orderId: `PO-${request.invocationId}` };
  },
};

function normalizeError(error: unknown): ToolExecutionError {
  return {
    code: "HOST_EXECUTION_FAILED",
    message: error instanceof Error ? error.message : "Unknown host error",
    retryable: false,
  };
}

runtime.registerTool({
  id: "orders.create",
  version: "1.0.0",
  inputSchema: {
    type: "object",
    required: ["buyer"],
    properties: { buyer: { type: "string" } },
  },
  outputSchema: {
    type: "object",
    required: ["orderId"],
    properties: { orderId: { type: "string" } },
  },
  annotations: { sideEffect: true, confirmation: "required", retry: "safe" },
});

const { invocation, surface } = runtime.createToolSurface({
  toolId: "orders.create",
  surfaceId: "order-form",
  initialValues: { buyer: "Ada" },
});

runtime.onInvocationRequested(async (request) => {
  try {
    runtime.markInvocationStarted(request.invocationId);
    const result = await hostExecutor.execute(request);
    runtime.resolveInvocation(request.invocationId, result);
  } catch (error) {
    runtime.rejectInvocation(request.invocationId, normalizeError(error));
  }
});

const agentTools = new AgentUIToolRuntime(
  components,
  store,
  undefined,
  runtime,
);

const confirmation = runtime.handleAction({
  id: "submit-order",
  surfaceId: surface.id,
  nodeId: surface.tree.id,
  action: "tool.submit",
  input: { invocationId: invocation.id },
});
if (confirmation.kind !== "confirmation-required") {
  throw new Error("Expected side-effect confirmation");
}
runtime.handleAction({
  id: "confirm-order",
  surfaceId: confirmation.confirmationSurface.id,
  nodeId: confirmation.confirmationSurface.tree.id,
  action: "tool.submit",
  input: { invocationId: invocation.id, confirmed: true },
});
void agentTools;
```

`fromOpenApiOperation` and `fromAgentToolDefinition` convert definitions only; they never retain execution authority. In RC.4, the OpenAPI adapter accepts one host-selected, dereferenced OpenAPI 3.1 operation rather than importing a complete document directly. Header and cookie parameters are Host-owned by default, so tenant, authorization, and session values do not enter the generated form; a trusted Host may explicitly expose only a non-sensitive business Header. The [tea-purchase OpenAPI fixture](examples/tea-purchase/openapi.json) now drives the example's real initial Surface through the public Generator, Store, and React Renderer APIs; it remains the acceptance baseline for the next full-document adapter increment. See [OpenAPI to Default Form](docs/guide/openapi-to-form.md). Renderer actions go through `runtime.handleAction(intent)`. Side-effect confirmation, registered tool/version checks, read-only projection, duplicate submission, idempotency, sensitive event redaction, and retry policy are Runtime invariants.

## Register a Component Pack

Install only the bindings used by the host:

```bash
npm install @surfaceweave/core@next @surfaceweave/react@next react react-dom
npm install @surfaceweave/react-aria@next react-aria-components
# or
npm install @surfaceweave/antd@next antd
```

The serializable Manifest and local React bindings are separate. Registering a Pack adds its trusted semantic schemas to Core, while the binding stays in the React package.

```tsx
import { createStandardComponentRegistry } from "@surfaceweave/core";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
import { createReactAriaComponentPack } from "@surfaceweave/react-aria";
import "@surfaceweave/react-aria/styles.css";

const components = createStandardComponentRegistry();
const reactComponents = createStandardReactComponentRegistry(components);
reactComponents.registerPack(createReactAriaComponentPack({ locale: "en-US" }));
```

Ant Design accepts host-only `ConfigProvider` options through `createAntDesignComponentPack({ theme, locale })`; those values never enter the Surface or Manifest. See [Component Pack authoring](docs/component-pack-authoring.md) for custom semantic components and fallback.

## Create and Render a Surface

```tsx
import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  recommendedSurfaceResourcePolicy,
} from "@surfaceweave/core";
import { generateSurface } from "@surfaceweave/generator";
import {
  SurfaceRenderer,
  createStandardReactComponentRegistry,
} from "@surfaceweave/react";

const components = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(components, {
  resourcePolicy: recommendedSurfaceResourcePolicy,
});
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
      preferredPack="react-aria"
      enabledPackIds={["react-aria", "default"]}
      capabilities={["web"]}
      actionStateSource={toolRuntime.actionStateSource}
      onActionIntent={(intent) => hostActionExecutor.execute(intent)}
    />
  );
}
```

## Define Portable Form Layout

Current `main` generates single-column forms by default. Developer soft hints
may add workspace columns, field spans, and explicit semantic Sections without
changing bindings or data:

```ts
const surface = generateSurface(
  {
    surfaceId: "purchase",
    intent: "form",
    schema: purchaseSchema,
    data: {},
    developer: {
      softHints: {
        layout: { columns: 2, gap: 16 },
        groups: {
          delivery: { title: "Delivery", layout: { columns: 2, gap: 8 } },
        },
        fields: {
          receiver: { group: "delivery" },
          address: { group: "delivery", layout: { span: 2 } },
        },
      },
    },
  },
  components,
);
```

Compact views safely use one column. Agent `setLayout` operations accept the
same JSON-only vocabulary and reject CSS, `className`, DOM, and vendor props.
See the [Semantic Layout guide](docs/guide/semantic-layout.md).

## Connect Agent Tool Calls

Pass `runtime.definitions()` to the host Agent SDK, then route returned calls through the host-neutral runtime. Invalid arguments and revision conflicts are returned as data.

```ts
import { AgentUIToolRuntime } from "@surfaceweave/agent-tools";

const runtime = new AgentUIToolRuntime(components, store);
const definitions = runtime.definitions();

const result = runtime.execute(toolCall.name, JSON.parse(toolCall.arguments));
if (!result.ok) {
  console.error(result.error.code, result.error.message);
}
```

Call `ui.inspectComponentPacks` to give an Agent the current semantic component schemas, capabilities, fallback, renderer/pack identifiers, and concise `agentGuidance`. The result is JSON-only and never exposes React components or vendor APIs.

In RC.4, construct `AgentUIToolRuntime` with trusted
`clientCapabilities` options. The same filtered projection powers
`createSurfaceClientCapabilities` and `ui.inspectComponentPacks`; remote Agent
arguments can only narrow the host's Pack and terminal-capability allow-list.
SurfaceWeave returns the JSON snapshot but leaves transport to the host. See
[Capabilities and Action State](docs/guide/capabilities-action-state.md).

`ui.applyOperations` and `ui.replaceSurface` are session-only overrides: they update the Surface Store but never persist user preferences. Use the separate async preference runtime for confirmed long-term changes.

## Persist and Apply Preferences

Hydrate preferences before creating Surfaces, then pass the service into the Surface tool runtime. Preference operations target `stableId`, not generated node IDs or array indexes.

```ts
import type { PreferenceDocument } from "@surfaceweave/core";
import {
  AgentUIToolRuntime,
  PreferenceAgentToolRuntime,
} from "@surfaceweave/agent-tools";
import {
  PreferenceRepository,
  PreferenceService,
  parsePreferenceDocument,
} from "@surfaceweave/preferences";
import { LocalStorageAdapter } from "@surfaceweave/storage";

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

Tool UI should subscribe to `toolRuntime.actionStateSource`; it projects the
existing `ToolInvocation` lifecycle rather than creating another authority.
For non-Tool actions, RC.4 provides the host-owned
`InMemoryActionExecutionController`. Only `ActionResult.status === "success"`
marks an action successful. The host alone may temporarily gate a Surface with
`setInteractionDisabled`; neither an Agent nor Surface data can set that flag.

In Tauri, register semantic host actions and let trusted handlers choose fixed Rust command names:

```ts
import { createTauriDynamicUIAdapter } from "@surfaceweave/tauri";

const desktop = createTauriDynamicUIAdapter({
  namespace: "tea-purchase",
  userId: currentUser.id,
  capabilities: {
    platform: "macos",
    desktop: true,
    filePicker: false,
    notifications: false,
    localStorage: true,
    nativeCommands: true,
  },
});

desktop.actionExecutor.register("tea.search", async (input, { invoke }) =>
  invoke("search_teas", { query: input }),
);
```

The security chain is: trusted component emits an `ActionIntent` → semantic action allow-list validates it → host handler selects a fixed command → Tauri capability authorizes that command → Rust validates the payload. A capability descriptor is UI discovery metadata, not authorization. The example grants only its two application commands and the Store operations it uses; it does not grant shell, filesystem, HTTP, or arbitrary command access, and its CSP permits only bundled assets, IPC, and the local Vite development endpoint.

## Peer Dependencies

The default renderer supports React `>=18.2 <20`; its optional `./dom` entry
needs React DOM `>=18.2 <20`, while the package root does not load React DOM.
React Aria additionally needs
React DOM `>=18.2 <20` and `react-aria-components >=1.20 <2`. Ant Design needs
React DOM `>=18.2 <20` and `antd >=6.5.3 <7`. These libraries are peers of their
optional Pack and are not pulled into Core or unrelated consumers. Tauri is a
separate package and installs only its Tauri 2 API/Store dependencies.

See the [public API baseline](docs/public-api.md), [compatibility matrix](docs/npm-compatibility-matrix.md), [release checklist](docs/npm-release-checklist.md), [Trusted Publishing guide](docs/npm-trusted-publishing.md), [Tool-to-UI guide](docs/tool-to-ui-runtime.md), [no-workflow ADR](docs/adr/0001-no-frontend-workflow-engine.md), and [architecture baseline](docs/dynamic-ui-architecture.md).
