# Milestone 6.3 Summary — Capabilities, Action State, and Resource Policy

## Outcome

Milestone 6.3 adds three optional, framework-neutral host controls without
changing Wire Protocol 1.0 or replacing the existing Tool Invocation lifecycle.
The work remains unreleased on `main`: all package versions stay
`0.1.0-rc.3`; no tag, GitHub Release, or npm publication was created.

## Delivered

- a standalone, JSON-only Surface Client Capabilities document and Draft
  2020-12 Schema;
- deterministic host-filtered Pack/component projection shared by
  `createSurfaceClientCapabilities` and `ui.inspectComponentPacks`;
- a read-only Action execution contract, a host-owned non-Tool controller, and
  a Tool state projection backed by the existing `ToolInvocation` authority;
- pending-call coalescing, `ActionResult`-aware success, safe retry of original
  normalized input/idempotency key, cancellation, attempts, and a host-only
  interaction gate;
- optional Action state in React bindings and `@surfaceweave/react/dom`, with
  pending/error behavior in the default Form, Action, Dialog, and Confirm
  components;
- opt-in `SurfaceResourcePolicy` enforcement for create, replace, data update,
  and Operation commits, plus a recommended policy and capability summary;
- Agent-facing Web/Tauri examples, public API/security/authoring guidance, and
  clean-tarball consumer/release-audit coverage.

## Completion audit

| Requirement               | Evidence                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host authority            | Agent catalog queries only narrow a deep-copied host snapshot; runtime bindings and functions are absent.                                                    |
| One Tool lifecycle        | Tool Action state is derived from `ToolInvocation`; no Renderer-owned success transition exists.                                                             |
| Action concurrency        | Tests cover pending to success/failure/cancel, exact Promise coalescing, original-input retry, attempt increments, and host interaction gating.              |
| Shared views              | React and DOM Driver tests cover two views, Surface switching without an old snapshot, and subscription cleanup.                                             |
| Atomic resource rejection | Tests cover node/depth/string/bytes/batch limits and unchanged Surface, revision, events, and listeners on failure.                                          |
| RC.3 compatibility        | Resource budgets are opt-in; existing APIs, Wire fields, and Pack bindings remain accepted.                                                                  |
| Package boundaries        | Protocol/Core consumers compile without DOM; React root remains independent of `react-dom`; no Agentdown, Vue, vendor Pack, or network dependency was added. |

Final validation under Node 22:

```text
pnpm install --frozen-lockfile   passed
pnpm build                       passed (known demo/AntD chunk warnings)
pnpm typecheck                   passed
pnpm lint                        passed
pnpm test                        36 files / 152 tests passed
pnpm verify:packages             10 tarballs / 11 clean consumers passed
pnpm audit:release               10 package audits passed
pnpm verify:release              npm dry-runs passed
pnpm docs:build                  passed
pnpm check:tauri                 cargo check passed
pnpm build:tauri --no-bundle     release build passed
```

## RC.4 compatibility notes

- New Protocol subpaths, Core types/helpers, Agent runtime options, and React
  props are additive and optional.
- `SurfaceResourceLimits`, the `limits` Store option, and legacy helper names
  remain deprecated aliases; new code should use `SurfaceResourcePolicy` and
  `resourcePolicy`.
- Pending duplicate Tool submissions now coalesce instead of throwing, which
  is an intentional idempotency hardening behavior change to call out in RC.4
  release notes.
- Published RC.3 artifacts are unchanged. RC.4 versioning, tag creation, OIDC
  publication, and post-publish validation require separate confirmation.

## Not implemented

No AG-UI/A2UI transport, Agent SDK, remote Pack discovery, Vue/Flutter
Renderer, Web Component, workflow engine, automatic Pack download, product
feature, or new host Adapter was added.
