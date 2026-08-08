# Preferences and Storage

Preferences are structured patches relative to deterministic default UI. They
can be scoped globally, by intent, or by Tool. Developer hard constraints are
always enforced; soft hints and durable preferences guide composition. Agent
overrides apply only to the current interaction and do not mutate long-term
preferences.

## Browser persistence

```bash
npm install @surfaceweave/preferences@next @surfaceweave/storage@next
```

```ts
import type { PreferenceDocument } from "@surfaceweave/core";
import {
  PreferenceRepository,
  PreferenceService,
  parsePreferenceDocument,
} from "@surfaceweave/preferences";
import { LocalStorageAdapter } from "@surfaceweave/storage";

const storage = new LocalStorageAdapter<PreferenceDocument>(
  "surfaceweave.preferences",
  parsePreferenceDocument,
);
const repository = new PreferenceRepository(storage);
const preferences = new PreferenceService(repository, components);

await preferences.hydrate();
```

The adapter stores only JSON-compatible preference documents. Surface form
data remains separate and is retained by the `SurfaceStore` for the current
interaction.

## Replace the backend

Storage is an interface, not a browser assumption. Implement the Core
`StorageAdapter<T>` contract or use `BackendStorageAdapter` to connect a host
transport. Preserve optimistic version checks so competing writes fail instead
of silently overwriting preferences.

## Schema evolution

Use stable IDs, schema versions, and field aliases when inputs evolve.
Conflicting or incompatible patches produce explicit events and must be
migrated or discarded through the provided Agent tools—never guessed during
rendering.

See [Milestone 2 design decisions](/milestone-2-decisions) for precedence,
conflicts, migration, and durable-write behavior.
