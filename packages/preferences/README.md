# @surfaceweave/preferences

Scoped, structured Preference Patches, conflict detection, and explicit
migration over generated Dynamic UI Surfaces.

`PreferenceRepository` serializes saves, removals, and reloads within one
instance. Each write uses the latest committed document and updates the cache
only after persistence succeeds; a failed write does not block later operations.
Await initial hydration before using the repository. Separate instances, tabs,
or processes still require host-owned storage coordination or version checks.

```sh
npm install @surfaceweave/core@next @surfaceweave/storage@next @surfaceweave/preferences@next
```
