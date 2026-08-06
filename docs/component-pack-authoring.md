# Component Pack Authoring

## Boundary

A Pack has three independent layers: the JSON Wire Protocol, a serializable `ComponentPackManifest`, and a renderer-local runtime binding. TypeScript Core is only the reference implementation. The published `@package-first/protocol` package exposes the Draft 2020-12 Schema at `@package-first/protocol/schema`; non-JavaScript runtimes can consume it directly.

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
  fallback: "Card",
};
```

Then provide one binding per renderer. A React binding receives `node`, the bound `value`, `onValueChange`, and `onAction`. It must emit an ActionIntent through `onAction`; it must not call business APIs directly.

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

Run `validateComponentPack(manifest)` and `validateReactComponentPack(pack, registry)` in CI. Manifests reject functions, JSX/code strings, unsafe keys, invalid schemas, missing fallback targets, cycles, and incomplete bindings.

## Resolution and Fallback

The host supplies renderer kind, capabilities, preferred Pack, priorities, accepted versions, and an optional enabled-Pack allow-list. Resolution is deterministic. If a renderer lacks `TeaProductCard`, it renders its semantic `Card` fallback without rewriting the Surface.

Use namespaced, versioned `extensions` only when a semantic property cannot represent a library feature. Each extension needs its own JSON Schema. Generators and Agents should not emit vendor extensions by default; durable preferences should avoid them.

React Aria owns its stylesheet and locale provider. Ant Design theming is passed to `createAntDesignComponentPack({ theme, locale })` and remains outside the wire contract.
