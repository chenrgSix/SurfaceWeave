# Package First Dynamic UI SDK

A package-first, framework-agnostic conversational UI runtime. JSON Schema and interaction intent produce a trusted declarative `Surface`; business Agents modify it through typed UI tools; renderers subscribe to the same `SurfaceStore`; host applications execute structured `ActionIntent` values.

Milestone 1 implements the in-memory runtime, deterministic generator, Agent tools, React renderer, and tea-purchase example. The core package has no React dependency.

## Packages

| Package                         | Responsibility                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `@package-first/core`           | Protocol types, component allow-list, Surface Store, Operations, events, and ActionIntent validation |
| `@package-first/generator`      | Deterministic generation from a small JSON Schema subset                                             |
| `@package-first/agent-tools`    | Portable JSON Schema tool definitions, validation, and handlers                                      |
| `@package-first/renderer-react` | Trusted React implementations and shared Store rendering                                             |
| `@package-first/tea-purchase`   | Runnable Vite acceptance example                                                                     |

## Development

Use Node 22 and pnpm 10:

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

See [Milestone 1 decisions](docs/milestone-1-decisions.md) and the [architecture baseline](docs/dynamic-ui-architecture.md) for protocol boundaries and explicit non-goals.
