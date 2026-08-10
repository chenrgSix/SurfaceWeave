# @surfaceweave/core

Framework-independent Dynamic UI types, registries, Surface Store, semantic
operations, invocation state, and CSP-safe JSON Schema validation.

```sh
npm install @surfaceweave/core@next
```

This package does not depend on React, DOM, a Component Pack, Tauri, or a
network client.

On the unreleased `main` branch, hosts may configure resource guardrails and
observer error reporting without changing the wire protocol:

```ts
import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
} from "@surfaceweave/core";

const registry = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(registry, {
  limits: { maxNodes: 500, maxOperationsPerBatch: 50 },
  onListenerError: (error, event) => console.error(event.type, error),
});

store.dispose(); // Release in-memory state and subscriptions at session end.
```
