# @surfaceweave/protocol

Language-neutral Dynamic UI wire protocol, JSON Schema 2020-12 contract, and
Component Pack and Tool-to-UI specifications. It has no runtime dependencies.

```sh
npm install @surfaceweave/protocol@next
```

Import the normative wire schema from `@surfaceweave/protocol/schema`.

The unreleased `main` branch also exposes the framework-neutral Semantic
LayoutSpec document at `@surfaceweave/protocol/layout` and its strict JSON
Schema at `@surfaceweave/protocol/layout-schema`. Those subpaths require a
release after RC.3.

The schema has the stable, non-resolvable identity
`urn:surfaceweave:schema:dynamic-ui-wire:1.0`. Consumers must not require a
TypeScript package or an owned web domain to implement the protocol.
