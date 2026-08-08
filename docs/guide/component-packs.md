# Component Packs

A Component Pack has two separate parts:

1. A serializable manifest describing semantic support, fallback, capabilities,
   and framework identity.
2. A Renderer-specific Runtime Binding containing trusted implementations.

The Surface contains semantic component names such as `TextField`, never
vendor components such as `AntInput`.

## Default React Pack

The default binding ships with `@surfaceweave/react`:

```ts
import { createStandardReactComponentRegistry } from "@surfaceweave/react";

const reactComponents = createStandardReactComponentRegistry(components);
```

## React Aria

```bash
npm install react-aria-components @surfaceweave/react-aria@next
```

```ts
import { createReactAriaComponentPack } from "@surfaceweave/react-aria";

reactComponents.registerPack(createReactAriaComponentPack());
```

Select it with `preferredPack="react-aria"` and include that Pack
ID in `enabledPackIds`.

## Ant Design

```bash
npm install antd @surfaceweave/antd@next
```

```ts
import { createAntDesignComponentPack } from "@surfaceweave/antd";

reactComponents.registerPack(createAntDesignComponentPack());
```

Select it with `preferredPack="antd"`. Ant Design is not installed
or bundled when consumers use only the default or React Aria Pack.

## Custom business components

Declare the semantic component and its fallback in the framework-neutral
registry/manifest. Register a separate implementation for each Renderer. When
an implementation is absent, the Renderer follows the semantic fallback;
callers do not rewrite the Surface for a framework.

A business application can define this Pack locally. Component library choice
and host framework choice are independent: Vue, Svelte, Agentdown, or plain DOM
hosts can all mount the same React Renderer Driver, while the driver selects
only locally registered and host-enabled React Packs. No per-library or
per-Agent-host Adapter package is required.

See the
[Component Pack Protocol](https://github.com/chenrgSix/SurfaceWeave/blob/main/protocol/component-pack-protocol.md)
for manifest fields, selection rules, version negotiation, and the non-React
renderer contract.
