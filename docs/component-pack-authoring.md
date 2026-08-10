# Component Pack Authoring

## Boundary

A Pack has three independent layers: the JSON Wire Protocol, a serializable `ComponentPackManifest`, and a renderer-local runtime binding. TypeScript Core is only the reference implementation. The published `@surfaceweave/protocol` package exposes the Draft 2020-12 Schema at `@surfaceweave/protocol/schema`; non-JavaScript runtimes can consume it directly.

Semantic UI uses names such as `ChoiceField` and `Card`, never `Select` from a vendor library. This keeps Surface data, `stableId`, Preference Patch, and Agent Operations portable.

## Author a Semantic Component

Declare the cross-framework contract first:

```ts
const teaProductCard: ComponentManifest = {
  semanticType: "TeaProductCard",
  propsSchema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: { items: { type: "array" }, multiple: { type: "boolean" } },
  },
  binding: { valueTypes: ["array"] },
  actions: ["select"],
  layoutCapabilities: ["span"],
  fallback: "Card",
};
```

Then provide one binding per renderer. A React binding receives `node`, the bound `value`, `onValueChange`, and `onAction`. It must emit an ActionIntent through `onAction`; it must not call business APIs directly.

On current `main`, React bindings may also read optional, immutable
`actionStates` and `interactionDisabled` props. Existing bindings need no
change. A Pack may show pending or error feedback, but it must not mutate the
state, declare an action successful, or bypass the host-disabled gate.

```ts
const pack: ReactComponentPack = {
  manifest: {
    protocolVersion: "1.0",
    id: "tea-business",
    version: "1.0.0",
    rendererKind: "react",
    components: [teaProductCard],
    agentGuidance: { summary: "Use for selecting tea products." },
  },
  bindings: { TeaProductCard },
};

reactComponents.registerPack(pack);
```

The Pack may live inside the consuming application. A third-party design
system does not need its own SurfaceWeave package: declare stable semantic
components in a manifest, bind them to trusted local implementations, and
register the Pack at the application composition root. Publish a Pack only when
multiple applications actually need to share it.

Run `validateComponentPack(manifest)` and `validateReactComponentPack(pack, registry)` in CI. Manifests reject functions, JSX/code strings, unsafe keys, invalid schemas, missing fallback targets, cycles, and incomplete bindings.

## Layout capability boundary

LayoutSpec 1.0 is independent of a Renderer binding. A semantic container may
declare portable behavior such as:

```ts
const section: ComponentManifest = {
  semanticType: "BusinessSection",
  propsSchema: { type: "object" },
  layoutCapabilities: [
    "direction",
    "columns",
    "gap",
    "align",
    "justify",
    "span",
  ],
  fallback: "Section",
};
```

The declaration means the component can apply those semantic relationships; it
does not expose CSS properties. A Renderer calls the Core layout resolver,
maps supported values locally, and retains document order when a capability is
missing. `compact` and `workspace` overrides never select Packs or change host
capabilities. See the [Semantic Layout guide](guide/semantic-layout.md) and the
standalone `@surfaceweave/protocol/layout-schema` export.

## Resolution and Fallback

The host supplies renderer kind, capabilities, preferred Pack, priorities, accepted versions, and an optional enabled-Pack allow-list. Resolution is deterministic. If a renderer lacks `TeaProductCard`, it renders its semantic `Card` fallback without rewriting the Surface.

Use namespaced, versioned `extensions` only when a semantic property cannot represent a library feature. Each extension needs its own JSON Schema. Generators and Agents should not emit vendor extensions by default; durable preferences should avoid them.

React Aria owns its stylesheet and locale provider. Ant Design theming is passed to `createAntDesignComponentPack({ theme, locale })` and remains outside the wire contract.

Component Packs and host integration are separate concerns. A DOM host uses one
Renderer Driver regardless of which React Pack is enabled; SurfaceWeave does
not require an Adapter package for every component library or Agent host.
