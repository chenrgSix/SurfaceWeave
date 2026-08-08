# React Renderer

`@surfaceweave/react` is an optional Runtime Binding. It consumes Core
contracts but does not redefine them.

## Install

```bash
npm install react react-dom @surfaceweave/react@next
```

## Register components and render

```tsx
import {
  SurfaceRenderer,
  createStandardReactComponentRegistry,
} from "@surfaceweave/react";

const reactComponents = createStandardReactComponentRegistry(components);

function DynamicSurface() {
  return (
    <SurfaceRenderer
      surfaceId="order-form"
      store={surfaces}
      componentRegistry={components}
      reactComponents={reactComponents}
      mode="workspace"
      onActionIntent={(intent) => runtime.handleActionIntent(intent)}
    />
  );
}
```

The semantic `ComponentRegistry` comes from Core. The React registry maps those
semantic names to trusted React implementations. Unknown components are
rejected or resolved through declared semantic fallback.

## Share chat and workspace state

Render the same `surfaceId` and `SurfaceStore` twice:

```tsx
<SurfaceRenderer {...shared} mode="compact" />
<SurfaceRenderer {...shared} mode="workspace" />
```

Both views subscribe to the same Store. A field update from either view writes
through its `DataBinding` and is visible in the other view immediately.

## Security boundary

- Register only trusted component implementations.
- Treat every `ActionIntent` as untrusted input at the host boundary.
- Do not use `eval`, inject raw HTML, or execute values from Surface props.
- Keep API clients and credentials in the Host Executor, not components.
