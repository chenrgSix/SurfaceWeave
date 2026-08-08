# Tool-to-UI Runtime

The Runtime manages one Tool interaction at a time: input Surface, validation,
confirmation, invocation state, result Surface, and structured events. Ordering
multiple Tools remains the responsibility of the business Agent or backend.

## Connect the Host Executor

Listen for validated requests, mark the invocation as running, and pass only
the structured request to your host-owned executor.

```ts
import type { ToolHostExecutor } from "@surfaceweave/core";

const hostExecutor: ToolHostExecutor = {
  async execute(request) {
    // Apply authentication, authorization, and business validation here.
    return api.createOrder(request.arguments);
  },
};

runtime.onInvocationRequested(async (request) => {
  try {
    runtime.markInvocationStarted(request.invocationId);
    const result = await hostExecutor.execute(request);
    runtime.resolveInvocation(request.invocationId, result);
  } catch (error) {
    runtime.rejectInvocation(request.invocationId, {
      code: "HOST_EXECUTION_FAILED",
      message: error instanceof Error ? error.message : "Unknown host error",
      retryable: false,
    });
  }
});
```

## Handle an ActionIntent

Renderer components never receive arbitrary callbacks. They emit a validated
`ActionIntent` containing an action name, Surface identity, revision, node
identity, and JSON input. Forward the intent to the Runtime:

```ts
function onActionIntent(intent: ActionIntent) {
  runtime.handleActionIntent(intent);
}
```

For a side-effecting Tool, the Runtime first emits a confirmation state. Render
that state and submit the follow-up confirmation action; do not bypass the
Host Executor's authorization.

## Let an Agent adjust UI

Expose the framework-neutral Agent tool definitions from
`@surfaceweave/agent-tools`. Calls such as `ui.applyOperations` accept semantic
operations and a required `baseRevision`. A stale revision or invalid batch is
rejected atomically, leaving the Surface unchanged.

The Agent may move, group, hide, or replace registered semantic components. It
cannot generate JSX, JavaScript, React components, or network calls.

See [Tool Runtime design](/tool-to-ui-runtime) for the complete lifecycle and
event model.
