# Component Pack Migration

## From Isolated React Registration

`ReactComponentRegistry.register(type, component)` remains as a deprecated compatibility API. New integrations should declare a serializable semantic manifest and register one `ReactComponentPack`:

1. Move component props, binding types, actions, capabilities, and fallback into `ComponentManifest`.
2. Keep React component references and providers only in `bindings` and `Provider`.
3. Register the semantic definition before generating Surfaces, or let `registerPack` register it.
4. Replace vendor component names in Surface metadata with semantic names.
5. Configure `preferredPack`, `enabledPackIds`, and terminal `capabilities` on `SurfaceRenderer`.
6. Validate the Pack and run the clean tarball consumer test.

No migration is required for existing semantic `Surface`, `stableId`, data, or Preference Patch values. Pack switching is a host rendering decision and does not increment Surface revision.

## Compatibility Notes

- Legacy semantic aliases such as `Select`, `Table`, and `Confirm` fall back to the canonical `ChoiceField`, `DataTable`, and `Dialog` declarations.
- Unsupported `protocolVersion` values and malformed semantic versions are rejected during registration.
- Hosts may set `supportedPackVersions` to reject a locally installed Pack version with a `PACK_VERSION_INCOMPATIBLE` diagnostic.
- A missing preferred Pack reports `PREFERRED_PACK_UNAVAILABLE`; capability mismatch and semantic fallback also produce explicit diagnostics.
- A Pack cannot override developer hard constraints because resolution never mutates the Surface.

Do not migrate vendor props into generic `props`. If a feature is essential, define a semantic property or a versioned, schema-validated extension with a safe fallback.
