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
