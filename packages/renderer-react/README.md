# @surfaceweave/react

Trusted React runtime binding for semantic Dynamic UI Surfaces, including the
default Component Pack.

```sh
npm install react@^19 @surfaceweave/core@next @surfaceweave/react@next
```

React 18.2 and 19 are supported peer versions.

The package root does not load `react-dom`. DOM hosts can opt in to the isolated
driver entry:

```ts
import { createReactDOMRendererDriver } from "@surfaceweave/react/dom";

const driver = createReactDOMRendererDriver({
  store,
  componentRegistry,
  reactComponents,
  onActionIntent,
  actionStateSource: toolRuntime.actionStateSource,
});
const view = driver.mount(element, {
  surfaceId: "purchase",
  mode: "compact",
});
```

Install `react-dom` only when using `@surfaceweave/react/dom`. Pack allow-lists,
capabilities, priorities, and version constraints belong in the trusted driver
factory options, never in a remote Surface view reference.

In RC.4, `SurfaceRenderer` and the DOM Driver accept an optional
`actionStateSource`. Bindings receive optional read-only `actionStates` and
`interactionDisabled` props. Existing Packs may ignore both. The default Form,
Action, Dialog, and Confirm bindings show pending/error state and do not emit
actions while the trusted host gate is active.

Each emitted interaction has a fresh random ActionIntent id, including across
shared views and remounts. Treat the id as opaque and preserve it when replaying
the same intent for deduplication; a later click creates a new intent. The
renderer uses the browser's `crypto.getRandomValues` without requiring HTTPS-only
`randomUUID`. The ActionIntent wire shape is unchanged.

In RC.4, the default, React Aria, and Ant Design Packs resolve the
same Semantic LayoutSpec. `safeLayoutStyle` maps portable container values;
`safeLayoutItemStyle` applies only grid-item `span`. Compact mode safely uses a
single column, and unknown layout properties are never forwarded to React or
the DOM.
