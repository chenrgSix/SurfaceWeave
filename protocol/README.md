# @surfaceweave/protocol

Language-neutral Dynamic UI wire protocol, JSON Schema 2020-12 contract, and
Component Pack and Tool-to-UI specifications. It has no runtime dependencies.

```sh
npm install @surfaceweave/protocol@next
```

Import the normative wire schema from `@surfaceweave/protocol/schema`.

RC.4 also exposes the framework-neutral Semantic
LayoutSpec and Surface Client Capabilities contracts. Import the capability
document from `@surfaceweave/protocol/client-capabilities` and its Schema from
`@surfaceweave/protocol/client-capabilities-schema`.

The capability object is descriptive data created from trusted local policy.
It cannot authorize a Pack or action, and receiving one from a remote party
must never mutate local Registry, Executor, or resource configuration.

The schema has the stable, non-resolvable identity
`urn:surfaceweave:schema:dynamic-ui-wire:1.0`. Consumers must not require a
TypeScript package or an owned web domain to implement the protocol.
