# Milestone 1 Design Decisions

## Package and Dependency Boundaries

`@surfaceweave/core` owns declarative protocols and in-memory state. It has no renderer, Agent SDK, network, storage, or React dependency. Generator and Agent Tools depend inward on Core. React is isolated in `renderer-react`; the example is the composition root.

## Trusted State Transition Model

- A `Surface` keeps component structure and form `data` separate.
- Node references accept `id` or globally unique `stableId`; array-index JSON Patch is not exposed.
- Every mutation supplies `baseRevision`. A mismatch returns `REVISION_CONFLICT` without changing state.
- Operation batches run against a clone, validate the complete candidate tree, then commit once and emit one deterministic, monotonically sequenced event.
- `replaceSurface` migrates old session values only where the same `stableId` has compatible binding type and semantic metadata.
- Store reads, registry reads, listener events, and returned values are defensive copies.

## Trust Boundaries

Generators can select only Core-registered components. React rendering adds a second allow-list mapping those names to local implementations. No component source code or handler is accepted through Surface data.

Components update only declared `DataBinding` paths. Business actions become JSON-only `ActionIntent` values and must name an action registered on that component. The SDK does not execute the intent; the embedding host supplies `ActionExecutor` and retains authorization, confirmation, idempotency, and network control.

Agent tools expose portable JSON Schema definitions. Their runtime rejects unknown fields, malformed schemas, invalid Operations, unknown components, and stale revisions with structured errors.

## Generator Guarantees

Milestone 1 supports `form`, `browse`, `single-select`, `multi-select`, and `confirm` using a deliberate JSON Schema subset. IDs derive from Surface ID and schema path. Field order is explicit metadata order followed by lexical path order. Generation uses no time, randomness, remote state, or model call.

## Not Implemented

- Persistent storage, LocalStorage, preference patches, preference migration, undo, or redo.
- Tauri, Vue, Flutter, AG-UI, or A2UI adapters.
- Full JSON Schema/OpenAPI/MCP conversion, conditional fields, or schema composition.
- `insertNode` and `removeNode`; Milestone 1 implements only the six requested Operations.
- Business workflow, permissions, API clients, submission freezing, or arbitrary code execution.
- Action lifecycle persistence and `action.requested`/`action.completed` Store events.
- Cross-process synchronization, databases, telemetry, or DevTools.

Recommended Milestone 2 work is structured preference patches with conflict reporting, storage adapters, undo/redo over committed events, fuller schema validation, and explicit action-result integration. Tauri should remain an adapter over the same ActionIntent and Store contracts.
