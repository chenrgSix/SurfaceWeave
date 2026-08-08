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
});
const view = driver.mount(element, {
  surfaceId: "purchase",
  mode: "compact",
});
```

Install `react-dom` only when using `@surfaceweave/react/dom`. Pack allow-lists,
capabilities, priorities, and version constraints belong in the trusted driver
factory options, never in a remote Surface view reference.
