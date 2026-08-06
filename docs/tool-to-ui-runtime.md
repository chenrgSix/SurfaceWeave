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

Generation priority is defaults and developer soft/semantic hints → persisted
Preference Patches → Agent session Operations → developer hard constraints.
Tool schemas and confirmation policy sit outside UI composition.

## Confirmation, Security, and Results

Side-effecting tools always require confirmation. Submitting disables the Form
and duplicate requests are rejected. Safe retry reuses the idempotency key.
Read-only fields are checked and omitted from submission. Sensitive paths are
redacted in events; only the Host request carries validated values.

Result Surfaces cover summaries, lists, empty success, partial output, and
retryable/non-retryable errors. Agent Operations alter the projection, never
the raw result. Compatible data migrates by stableId or explicit alias;
incompatible targets emit `ui.dataMigrationConflict`.

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
