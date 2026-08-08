# Tauri Integration

`@surfaceweave/tauri` is an optional host adapter for Tauri 2. It does not add
Tauri types or dependencies to Protocol or Core.

## Install

```bash
npm install @surfaceweave/tauri@next \
  @surfaceweave/storage@next \
  @surfaceweave/preferences@next
```

Install Tauri plugins in the desktop host according to the
[Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

## Create the adapter

```ts
import { createTauriDynamicUIAdapter } from "@surfaceweave/tauri";

const tauri = createTauriDynamicUIAdapter({
  namespace: "my-app",
  capabilities: {
    platform: "macos",
    desktop: true,
    filePicker: false,
    notifications: false,
    localStorage: true,
    nativeCommands: true,
  },
  storeFactory: async () => preferenceStore,
});
```

The returned adapter provides:

- `actionExecutor` for explicitly registered, allow-listed host actions;
- `preferenceStorage` for Tauri Store-backed preference documents;
- `capabilityProvider` for serializable renderer capability hints.

## Keep permissions narrow

Register each host action explicitly. Do not grant arbitrary HTTP, shell, or
filesystem permissions to the dynamic UI layer. Validate every action payload
again in the Rust host before crossing the command boundary.

The repository's `examples/tea-purchase-tauri` app demonstrates the same Tool
Definitions, Surface data, and ActionIntent lifecycle as the browser example.
Run `pnpm check:tauri` before starting it with `pnpm dev:tauri`.
