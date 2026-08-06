# Milestone 5 Summary

## Delivered

- Canonical Tool Definitions, deterministic Registry, and JSON Schema, Agent
  tool, and dereferenced OpenAPI Operation adapters.
- Nested Schema-to-UI generation with constraints, formats, nullable/union
  schemas, read-only data, stable IDs, defaults, and semantic hints.
- Serializable Invocation lifecycle and typed Host requests with confirmation,
  redaction, idempotency, duplicate prevention, cancellation, and safe retry.
- Immutable raw results plus semantic result Surfaces for summary, list, empty,
  partial, success, and error states.
- stableId/alias migration with conflict events and Tool-focused Agent APIs.
- Web and Tauri tea-purchase flows sharing definitions, data model, intents,
  mock Host executor, and Runtime. Web supports three Packs; Tauri supports two.

## Security and Compatibility

Core remains ES2022-only without React, DOM, HTTP, OpenAPI runtime, Agent SDK,
or Tauri dependencies. Agents and Packs cannot register or execute tools,
change schemas, weaken confirmation, submit modified read-only fields, or
mutate raw results. JSON Schema validation is CSP-safe and does not require
`eval`, `new Function`, or `unsafe-eval`. Existing Milestone 1–4 APIs remain
available.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm verify:packages
pnpm check:tauri
pnpm build:tauri --no-bundle
```

The Web flow was exercised in a browser across default, React Aria, and Ant
Design Packs. A bundled macOS Tauri build was also exercised from search through
side-effect confirmation and the final order result, including synchronized
views and data preservation after Agent Operations.

## Deferred

No workflow DSL/DAG/BPMN engine, Agent/model runtime, arbitrary API discovery,
cross-session business form state, production permission center, distributed
tasks, Vue/Flutter renderer, or dynamic Pack loading was added. Existing Vite
large-chunk warnings remain accepted follow-up work.
