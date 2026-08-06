# Milestone 2 Design Decisions

## Persistence Boundary

`@surfaceweave/storage` exposes `StorageAdapter<T>` with asynchronous `load`, `save`, and `clear`. `LocalStorageAdapter` is the browser implementation. `BackendStorageAdapter` delegates serialized reads and writes to a host-provided transport; it owns no URL, credentials, retry policy, or network client. `PreferenceRepository` must be hydrated explicitly and persists a complete versioned document before publishing a cache mutation.

## Preference Composition

A `PreferencePatch` stores one semantic, single-target operation relative to a generated default Surface. It never stores a full component tree or form data. Matching patches apply deterministically in `global`, `intent`, then `tool` order, with patch ID as the stable tie-breaker.

The effective UI is composed as:

1. Generator defaults, guided by developer soft hints.
2. Persisted preference patches.
3. Agent session operations or replacement.
4. Developer hard-constraint validation across every layer.

Agent Surface tools never write the preference repository. Durable writes use the separate asynchronous preference tools and `ui.savePreference` requires explicit confirmation.

## Schema Evolution and Conflicts

Preferences address fields by `stableId` and may record a `{ id, version }` schema reference. An unchanged `stableId` remains valid across schema versions. When a target disappears, developer-provided field aliases can suggest current targets. Aliases are not applied silently: missing, ambiguous, versioned, hard-constraint, and invalid-operation cases become structured `PreferenceConflict` values.

Hosts or Agents inspect conflicts, then explicitly invoke `ui.migratePreference` or `ui.discardPreference`. Successful saves, conflicts, migrations, and discards emit deterministic preference events. Migration updates both the target and current schema reference.

## Trust and Priority Rules

Hard constraints define component allow-lists, required root/field components, fixed visibility, and locked component, props, layout, visibility, or position. Invalid preference or Agent changes are rejected before Surface state changes. Soft hints select labels, ordering, components, and layout only when compatible with the registry and hard constraints. Preference input rejects unknown fields and executable payloads.

## Explicitly Not Implemented

- Tauri or additional renderer adapters.
- Cross-tab or cross-process synchronization, server conflict merging, accounts, or encryption.
- Automatic alias migration, heuristic field matching, or silent preference deletion.
- Preference authoring UI, undo/redo, history compaction, or analytics.
- Business authorization, workflow, submission freezing, or ActionExecutor persistence.
