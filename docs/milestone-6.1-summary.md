# Milestone 6.1 Summary

Milestone 6.1 adds a Generic Renderer Driver without changing Wire Protocol
1.0. Core now exports four type-only contracts: `SurfaceViewMode`,
`SurfaceViewReference`, `SurfaceViewHandle`, and
`SurfaceRendererDriver<TTarget>`. Core remains buildable with `lib: ["ES2022"]`
and has no DOM or framework dependency.

`@surfaceweave/react/dom` exports `createReactDOMRendererDriver`. Trusted host
configuration owns the Store, registries, ActionIntent handler, Pack allow-list,
capabilities, priorities, and version constraints. Mounted references contain
only `surfaceId` and mode. The handle supports Surface switching and idempotent
unmount; Store subscriptions remain owned by the existing `useSurface` path.

Lifecycle coverage verifies initial rendering, automatic Store refresh, two
mount points sharing one Surface, Surface switching, ActionIntent forwarding,
and subscription cleanup. Package gates verify that the React root loads
without React DOM and that the `./dom` tarball entry type-checks and bundles in
a clean consumer. Documentation includes a non-published Agentdown/Vue
integration that keeps Agentdown in application code and shares one Store
between chat and workspace.

No Vue Renderer, Web Component, workflow feature, Agentdown Adapter, new
Component Pack, protocol change, tag, or npm publication was added.

## RC.3 proposal

After acceptance, publish all ten packages atomically as `0.1.0-rc.3` because
Core gains additive public types and React gains an additive optional subpath.
Use exact `0.1.0-rc.3` internal dependency ranges, retain `next`, rerun the full
clean-tarball and registry-consumer matrix, and leave RC.2 immutable.
