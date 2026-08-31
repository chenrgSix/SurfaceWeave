# Getting Started

SurfaceWeave converts a registered Tool Definition into a serializable
`Surface`. The host renders that Surface, receives `ActionIntent`, and decides
whether to execute the Tool. SurfaceWeave does not call business APIs or run
workflows.

## Requirements

- Node.js 22.13 or newer
- TypeScript with strict mode recommended
- React 18 or 19 only when using `@surfaceweave/react`

## Install the runtime

Install only the layers your host needs:

```bash
npm install @surfaceweave/core@next \
  @surfaceweave/generator@next \
  @surfaceweave/agent-tools@next
```

## Create a Tool surface

```ts
import { ToolToUIRuntime } from "@surfaceweave/agent-tools";
import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
} from "@surfaceweave/core";

const components = createStandardComponentRegistry();
const surfaces = new InMemorySurfaceStore(components);
const runtime = new ToolToUIRuntime(components, surfaces);

runtime.registerTool({
  id: "orders.create",
  version: "1.0.0",
  inputSchema: {
    type: "object",
    required: ["buyer"],
    properties: { buyer: { type: "string", title: "Buyer" } },
  },
  outputSchema: {
    type: "object",
    properties: { orderId: { type: "string" } },
  },
  annotations: {
    sideEffect: true,
    confirmation: "required",
    retry: "safe",
  },
});

const { invocation, surface } = runtime.createToolSurface({
  toolId: "orders.create",
  surfaceId: "order-form",
  initialValues: { buyer: "Ada" },
});
```

`surface` can cross a JSON boundary. `invocation` correlates later requests,
loading state, errors, results, and replacement Surfaces.

## Next steps

- Connect the [Tool-to-UI lifecycle](./tool-to-ui).
- Review the current [OpenAPI-to-form boundary](./openapi-to-form).
- Render the Surface with [React](./react-renderer).
- Select an optional [Component Pack](./component-packs).
- Try the [operations center demo](./operations-center), or inspect `examples/operations-center` in the repository. The original `examples/tea-purchase` remains the OpenAPI and multi-pack acceptance baseline.
