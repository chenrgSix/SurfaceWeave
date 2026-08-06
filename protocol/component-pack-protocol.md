# Dynamic UI Wire Protocol 1.0

## Status and Scope

This document is the language- and framework-independent definition of the Dynamic UI wire contract. The normative machine-readable artifact is [`schemas/dynamic-ui-wire.schema.json`](schemas/dynamic-ui-wire.schema.json), using JSON Schema Draft 2020-12 and the stable identifier `urn:surfaceweave:schema:dynamic-ui-wire:1.0`. TypeScript types in `@surfaceweave/core` are a reference implementation, not the protocol definition.

Both files are also published without runtime dependencies as `@surfaceweave/protocol`; JSON consumers can load the Schema from the `@surfaceweave/protocol/schema` export.

The protocol covers `Surface`, `UINode`, `DataBinding`, semantic operations, UI events, `ActionIntent`, preferences, and Component Pack Manifests. Every value crossing a trust boundary is JSON. Implementations in Rust, Java, Dart, Python, or another language can validate and process these documents without installing any JavaScript package.

## Three-layer Boundary

1. **Wire Protocol** — the JSON objects defined here.
2. **Component Pack Manifest** — serializable component schemas, capabilities, fallbacks, extensions, and concise Agent guidance.
3. **Runtime Binding** — local framework code that maps a semantic type to a trusted renderer implementation.

A runtime binding is never serialized. For example, `rendererKind: "react"` and `packId: "react-aria"` identify a local React Aria binding, while a future runtime may use `rendererKind: "vue"` and `packId: "element-plus"`. Both consume the same semantic Surface.

## Semantic UI

`UINode.component` names a semantic contract such as `TextInput`, `ChoiceField`, `Action`, `Form`, `Grid`, `Card`, `DataTable`, or `Dialog`. It never names `AntdInput`, `ReactAriaListBox`, a React component, or a Flutter widget. Switching packs changes runtime resolution only; it does not rewrite the Surface tree, data bindings, `stableId` values, or preference patches.

The wire contract contains no JSX, `ReactNode`, hooks, contexts, functions, DOM events, browser objects, dynamic imports, executable source strings, `className`, `antdProps`, or `reactAriaProps`.

## Manifest and Resolution

A `ComponentPackManifest` declares:

- protocol, pack, version, and renderer identifiers;
- a unique set of semantic components;
- JSON Schemas for props, actions, and optional extensions;
- required terminal capabilities;
- a semantic fallback;
- short, non-authoritative Agent guidance.

Resolution filters by `rendererKind`, locally installed bindings, terminal capabilities, Surface or host `preferredPack`, host-accepted Pack versions, and developer priority. Ties are resolved deterministically by priority, pack id, and version. An incompatible preferred Pack or version produces a diagnostic. Fallback chains are semantic, must terminate, and must not contain cycles.

Developer hard constraints apply to the semantic Surface before rendering. A pack cannot relax them because pack resolution never changes the stored semantic component.

## Vendor Extensions

Library-specific data is permitted only under `UINode.extensions`:

```json
{
  "extensions": {
    "vendor.pack-id": {
      "version": "1.0.0",
      "value": { "density": "compact" }
    }
  }
}
```

The namespace must be explicit, the version must match the manifest declaration, and `value` must pass the pack-provided JSON Schema. A runtime without that extension may ignore it and use the semantic component or its fallback. Generators and Agents should not author vendor extensions by default, and durable preferences should avoid them.

## Actions and Security

Components emit JSON-only `ActionIntent` documents. Runtime bindings do not call arbitrary URLs or host commands. The host validates the component action declaration and executes it through its `ActionExecutor`. Unknown actions, executable fields, dangerous objects, or schema-invalid inputs are rejected before dispatch.

## Compatibility

Wire Protocol `1.0` follows semantic-versioned pack manifests. Runtimes must reject unsupported protocol versions and diagnose incompatible pack versions. Adding optional fields is backward-compatible; removing fields, changing required semantics, or changing existing field meaning requires a new protocol version.
