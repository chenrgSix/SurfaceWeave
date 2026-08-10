# Capabilities, Action State, and Resource Policy

These RC.4 APIs let a trusted host describe what it can render, project
execution state into every view, and bound untrusted Surface work. They are
published through npm `next` and do not add a transport or change Wire Protocol
1.0.

## Create a trusted capability snapshot

Register semantic definitions and runtime Packs first, then project only the
Packs the host has enabled:

```ts
import {
  createSurfaceClientCapabilities,
  recommendedSurfaceResourcePolicy,
} from "@surfaceweave/core";

const capabilities = createSurfaceClientCapabilities(componentRegistry, {
  rendererKind: "react",
  enabledPackIds: ["default"],
  terminalCapabilities: ["web"],
  supportedPackVersions: { default: ["1.0.0"] },
  runtimeCapabilities: ["operations", "tool-invocation", "action-state"],
  resourcePolicy: surfaceStore.getResourcePolicySummary(),
});
```

The result is deterministic, deeply copied JSON. The host may include it in an
Agent request using its own transport. Never accept a remote capability object
as local configuration: it cannot register a Pack, binding, action, Executor,
or resource policy.

Pass the same trusted options to `AgentUIToolRuntime`. Its
`ui.inspectComponentPacks` tool uses the shared projection and Agent query
arguments can only narrow the result.

## Project Action state into views

Tool actions remain authoritative in `ToolInvocation`. Connect its read-only
projection to every view of the same Surface:

```tsx
<SurfaceRenderer
  surfaceId={surfaceId}
  store={surfaceStore}
  componentRegistry={componentRegistry}
  reactComponents={reactComponents}
  actionStateSource={toolRuntime.actionStateSource}
  onActionIntent={(intent) => toolRuntime.handleAction(intent)}
/>
```

The default bindings display pending/error state. A custom Pack may optionally
read `actionStates` and `interactionDisabled` from `RendererComponentProps`;
existing bindings can ignore both. During reconnect or recovery, only trusted
host code may call `toolRuntime.setInteractionDisabled(surfaceId, true)`.

For non-Tool actions, a host can use
`InMemoryActionExecutionController(ActionExecutor)`. Pending calls with the
same idempotency key share one execution; retry reuses the original intent and
key. A resolved Promise is successful only when the returned
`ActionResult.status` is `success`.

## Enable resource limits explicitly

```ts
const surfaceStore = new InMemorySurfaceStore(componentRegistry, {
  resourcePolicy: recommendedSurfaceResourcePolicy,
});
```

The Store validates create, replace, data updates, and Operation batches before
commit. Failures use `RESOURCE_POLICY_EXCEEDED` with `limit`, `allowed`,
`actual`, and `scope` details and do not advance revision or emit events.
Omitting `resourcePolicy` preserves RC.3 numeric acceptance behavior; plain
JSON, cycle, and prototype safety checks still apply.

The recommended policy is a starting point, not an authorization policy. Tune
it for the host's payload and memory budget.
