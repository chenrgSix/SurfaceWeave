# Tool-to-UI Runtime

## Ownership and Flow

The developer registers a canonical, versioned `ToolDefinition`. A business
Agent may select that tool and request a Surface, but only the SDK Registry can
resolve it. The deterministic Generator maps JSON Schema 2020-12 to semantic
components; Component Packs only choose renderer bindings.

1. `registerTool` validates schemas and immutable execution annotations.
2. `createToolSurface` creates an editing invocation and bound input Surface.
3. Components emit JSON-only `ActionIntent` values.
4. `handleAction` validates against the registered schema and enforces policy.
5. The Runtime emits `ToolSubmissionRequest`; the host executes, then calls
   `resolveInvocation` or `rejectInvocation`.
6. The Runtime stores an immutable raw result and creates a separate result
   projection Surface.

The Runtime never discovers endpoints, holds credentials, chooses business
tools, or calls a network client.

Core validates schemas and values with a CSP-safe interpreter. It does not use
`eval` or `new Function`, so Tauri and other strict-CSP hosts do not need to add
`unsafe-eval` to execute dynamically registered Tool or Component schemas.

## Definitions and Schema Mapping

Use a direct `ToolDefinition`, `fromAgentToolDefinition`, or a dereferenced
single OpenAPI 3.1 Operation through `fromOpenApiOperation`. Adapters copy
schemas but discard URLs and transport authority. Generation supports nested
objects, arrays, enums, nullable unions, defaults, required/read-only fields,
common formats, constraints, and practical `oneOf`/`anyOf` fallback.

OpenAPI path and query parameters default to user input. Header and cookie
parameters default to Host-owned context and are omitted from the canonical
Tool input Schema and generated form. A trusted Host may explicitly expose a
non-sensitive business Header through `parameterSources`; authorization, proxy
authorization, cookies, API keys, and security schemes cannot become
user-controlled fields. Host context must never be supplied as Surface initial
values; Tool submission projection also discards fields absent from the
canonical input Schema before creating `validatedArguments`.

The validated
[`examples/tea-purchase/openapi.json`](https://github.com/chenrgSix/SurfaceWeave/blob/main/examples/tea-purchase/openapi.json)
fixture intentionally includes full-document discovery, local references,
path-level parameters, and parameter-location grouping. The example Host
preprocesses those features before invoking the current RC.5 single-Operation
adapter; the published Generator does not yet perform them. See
[OpenAPI to Default Form](guide/openapi-to-form.md) for the exact boundary and
the next acceptance target.

Generation priority is defaults and developer soft/semantic hints → persisted
Preference Patches → Agent session Operations → developer hard constraints.
Tool schemas and confirmation policy sit outside UI composition.

## Confirmation, Security, and Results

Side-effecting tools always require confirmation. Submitting disables the Form
and pending duplicate submissions coalesce to the same outcome; the Host
request is emitted once. Safe retry reuses the original normalized input and
idempotency key while increasing `attempt`.
Read-only fields are checked and omitted from submission. Sensitive paths are
redacted in events; only the Host request carries validated values.

Result Surfaces cover summaries, lists, empty success, partial output, and
retryable/non-retryable errors. Agent Operations alter the projection, never
the raw result. Compatible data migrates by stableId or explicit alias;
incompatible targets emit `ui.dataMigrationConflict`.

In RC.4, `ToolToUIRuntime.actionStateSource` is a read-only Renderer
projection of that same `ToolInvocation`; it is not a second lifecycle store.
Only a Runtime success transition can project `succeeded`. The host-only
`setInteractionDisabled` gate supports recovery and reconnect periods and is
never read from Surface or Agent data. Non-Tool `ActionExecutor` calls may use
Core's separate `InMemoryActionExecutionController`.

## Agent Tools and Limits

`ui.inspectTools`, `ui.inspectTool`, `ui.createToolSurface`,
`ui.inspectInvocation`, and `ui.proposeToolSubmission` complement existing
Surface and preference tools. They cannot register tools, change schema or hard
policy, supply a URL, execute a tool, or resolve an invocation.

Milestone 5 does not add an Agent, workflow/DAG engine, remote discovery,
cross-session form recovery, production authorization service, Vue/Flutter
renderer, or Pack lazy loading.

The permanent ownership boundary is recorded in
[ADR 0001](adr/0001-no-frontend-workflow-engine.md). Existing Surface and
Invocation primitives are intentionally sufficient for current lightweight UI
continuity; there is no `InteractionSession` or frontend business-step engine.
