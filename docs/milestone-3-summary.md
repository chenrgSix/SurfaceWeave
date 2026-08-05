# Milestone 3 Summary

## Delivered Scope

Milestone 3 adds a Tauri 2 host adapter without changing the framework-independent Core. `@package-first/tauri` exports `TauriActionExecutor`, `TauriPreferenceStorage`, `TauriCapabilityProvider`, and `createTauriDynamicUIAdapter`. All Tauri APIs are isolated in that package.

`TauriActionExecutor` maps registered semantic actions to trusted host handlers. It rejects unknown actions, executable-code fields, command names, and URLs before invoking a handler. Validation, authorization, and handler failures return structured `ActionResult` errors while preserving trace and idempotency fields.

`TauriPreferenceStorage` uses the official Store plugin and the existing versioned `PreferenceDocument` codec. Namespaced user keys isolate data; corrupt or incompatible documents produce structured errors without replacing the last valid in-memory state. Surface form data and Tool results are never persisted.

## Security Boundary

Capability descriptions are discovery metadata, not authorization. The desktop example combines a semantic action allow-list with Tauri capabilities that expose only `search_teas`, `create_purchase`, and required Store operations. Rust payloads use typed structures with unknown-field rejection. CSP permits bundled assets, IPC, and the local Vite development server only.

## Acceptance Example

`examples/tea-purchase-tauri` demonstrates Rust-backed tea search, a generated multi-select Surface, shared compact/workspace state, a purchase form, Agent layout operations that preserve compatible data, durable remark preferences, non-durable form data, and visible unknown-action rejection.

## Verification

Run Node 22 and pnpm 10, then execute:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm check:tauri
pnpm build:tauri --no-bundle
```

## Explicit Non-goals

This milestone does not add another renderer, mobile targets, arbitrary Rust command generation, remote URLs, business authorization, workflow logic, AG-UI/A2UI compatibility, or Pretext. Platform-specific Windows and Linux packaging remain future validation work.
