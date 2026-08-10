# @surfaceweave/core

Framework-independent Dynamic UI types, registries, Surface Store, semantic
operations, invocation state, and CSP-safe JSON Schema validation.

```sh
npm install @surfaceweave/core@next
```

This package does not depend on React, DOM, a Component Pack, Tauri, or a
network client.

In the RC.4 candidate, hosts may opt into resource guardrails and
observer error reporting without changing the wire protocol. It also provides
framework-neutral LayoutSpec parsing and fallback:

```ts
import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  recommendedSurfaceResourcePolicy,
  resolveSemanticLayout,
} from "@surfaceweave/core";

const registry = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(registry, {
  resourcePolicy: {
    ...recommendedSurfaceResourcePolicy,
    maxNodes: 500,
    maxOperationsPerBatch: 50,
  },
  onListenerError: (error, event) => console.error(event.type, error),
});

store.dispose(); // Release in-memory state and subscriptions at session end.

const compact = resolveSemanticLayout(
  { columns: 2, modes: { compact: { columns: 1 } } },
  "compact",
);
```

RC.4 also exports the JSON-only client capability snapshot and read-only
Action execution contracts. `createSurfaceClientCapabilities` projects only
host-enabled Packs; `InMemoryActionExecutionController` is for non-Tool
actions. Tool actions use `ToolToUIRuntime.actionStateSource` so
`ToolInvocation` remains authoritative. Resource limits are opt-in: omitting
`resourcePolicy` preserves RC.3 numeric acceptance behavior.
