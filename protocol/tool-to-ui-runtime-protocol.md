# Tool-to-UI Runtime Wire Protocol

This document defines the language- and framework-neutral records introduced by
Milestone 5. The normative machine-readable contract is
`schemas/dynamic-ui-wire.schema.json`; TypeScript packages are reference
implementations only.

## Canonical Tool Definition

A host registers a `toolDefinition` before any Surface or invocation can refer
to it. The definition contains a stable `id`, explicit `version`, JSON Schema
2020-12 `inputSchema`, optional `outputSchema`, UI guidance, and execution
annotations. It never contains an endpoint, HTTP client, renderer component,
callback, or executable code.

Execution annotations are policy inputs. A side-effecting tool cannot declare
`confirmation: "never"`; agents, preferences, Surfaces, and component packs
cannot weaken this rule. `sensitiveInputPaths` identifies argument paths that
must be redacted in observable events.

## Definition Adapters

Adapters may derive this record from a direct JSON Schema, a dereferenced
OpenAPI 3.1 Operation, or an Agent SDK tool declaration. Adapters only copy and
normalize metadata and schemas. They do not retain transport URLs or execute
the described operation.

## Rendering Boundary

The generated Surface contains only semantic component names and serializable
data bindings. Component Pack selection is a renderer concern; changing a pack
does not alter the Tool Definition, Surface, form data, or invocation contract.

## Invocation and Host Boundary

Each `toolInvocation` follows the closed state set `idle`, `editing`,
`validating`, `awaiting-confirmation`, `submitting`, `success`, `error`, and
`cancelled`. Implementations must reject transitions outside the state machine.

`tool.submit` never identifies a URL or transport. After schema validation and
any mandatory confirmation, the Runtime emits a `toolSubmissionRequest` with a
registered tool id/version, projected arguments, correlation id, idempotency
key, source Surface, and logical sequence. Only the host may execute it and
later resolve or reject the invocation.

Observable `toolRuntimeEvent` records carry redacted argument projections.
Raw validated arguments are present only in the request delivered to the host.
Read-only schema fields are rendered as non-editable and removed from submitted
arguments; modifying them causes validation failure. While an invocation is
submitting, renderers disable the semantic Form submission control and the
Runtime rejects duplicates independently of renderer behavior.

## Results, Migration, and Agent Tools

The Runtime keeps an immutable cloned raw result outside the Surface Store and
creates a separate semantic result projection. Agent `UIOperation` batches may
reorder or restyle that result Surface but cannot mutate the raw result. Default
projections cover object summaries, collections, empty success, partial output,
structured errors, and retryable errors.

Input Surface replacement migrates compatible bindings by stableId. A
developer-supplied field alias may map an old stableId to a renamed field;
missing, ambiguous, and type-incompatible targets produce
`ui.dataMigrationConflict` events instead of coercing data.

Portable Agent tools expose registered Tool discovery, Tool Surface creation,
invocation inspection, and submission proposals. A proposal enters the same
validation and confirmation path as a user action. It cannot register a tool,
change its schemas or policies, supply a URL, execute it, or forge a result.
