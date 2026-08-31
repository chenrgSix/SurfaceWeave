import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  type ActionIntent,
  type Surface,
  type ToolRuntimeEvent,
  type ToolSubmissionRequest,
} from "@surfaceweave/core";
import { describe, expect, it, vi } from "vitest";

import { ToolToUIRuntime } from "../src/index.js";

function action(
  surface: string | Surface,
  actionName: string,
  invocationId: string,
  extra: Record<string, string | boolean> = {},
): ActionIntent {
  const surfaceId = typeof surface === "string" ? surface : surface.id;
  return {
    id: `${invocationId}-${actionName}`,
    surfaceId,
    nodeId:
      typeof surface === "string" ? `${surfaceId}--root` : surface.tree.id,
    action: actionName,
    input: { invocationId, ...extra },
  };
}

function runtimeFixture() {
  const components = createStandardComponentRegistry();
  const surfaces = new InMemorySurfaceStore(components);
  const runtime = new ToolToUIRuntime(components, surfaces);
  runtime.registerTool({
    id: "order.create",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["buyer", "password", "tenant"],
      properties: {
        buyer: { type: "string", minLength: 1 },
        password: { type: "string", minLength: 1 },
        tenant: { type: "string", readOnly: true },
      },
    },
    outputSchema: { type: "object" },
    annotations: {
      sideEffect: true,
      confirmation: "required",
      retry: "safe",
      sensitiveInputPaths: ["password"],
    },
  });
  return { runtime, surfaces };
}

describe("ToolToUIRuntime", () => {
  it("requires the active confirmation Surface before accepting confirmed input", () => {
    const { runtime } = runtimeFixture();
    const requested = vi.fn();
    runtime.onInvocationRequested(requested);
    const { invocation, surface } = runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "confirmation-owner",
      initialValues: { buyer: "Ada", password: "secret", tenant: "north" },
    });
    const forged = action(surface.id, "tool.submit", invocation.id, {
      confirmed: true,
    });
    expect(() => runtime.handleAction(forged)).toThrowError(
      expect.objectContaining({ code: "TOOL_CONFIRMATION_REQUIRED" }),
    );
    expect(runtime.inspectInvocation(invocation.id).status).toBe("editing");
    const pending = runtime.handleAction(
      action(surface.id, "tool.submit", invocation.id),
    );
    expect(pending.kind).toBe("confirmation-required");
    if (pending.kind !== "confirmation-required")
      throw new Error("Expected confirmation");
    expect(() =>
      runtime.handleAction({
        ...action(pending.confirmationSurface, "tool.submit", invocation.id, {
          confirmed: true,
        }),
        nodeId: "unrelated-node",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "TOOL_CONFIRMATION_REQUIRED" }),
    );
    expect(() => runtime.handleAction(forged)).toThrowError(
      expect.objectContaining({ code: "TOOL_CONFIRMATION_REQUIRED" }),
    );
    expect(requested).not.toHaveBeenCalled();
  });

  it.each(["data", "operations", "replacement", "confirmation", "readOnly"])(
    "invalidates confirmation after a %s change and rejects old confirmation replay",
    (change) => {
      const { runtime, surfaces } = runtimeFixture();
      const requested = vi.fn();
      runtime.onInvocationRequested(requested);
      const { invocation, surface } = runtime.createToolSurface({
        toolId: "order.create",
        surfaceId: "confirmation-drift",
        initialValues: { buyer: "Ada", password: "secret", tenant: "north" },
      });
      const pending = runtime.handleAction(
        action(surface.id, "tool.submit", invocation.id),
      );
      if (pending.kind !== "confirmation-required")
        throw new Error("Expected confirmation");
      // Repeated proposals for the same revision share the active confirmation.
      expect(
        runtime.handleAction(action(surface.id, "tool.submit", invocation.id)),
      ).toEqual(pending);
      const oldConfirm = action(
        pending.confirmationSurface,
        "tool.submit",
        invocation.id,
        { confirmed: true },
      );
      if (change === "replacement") {
        surfaces.replaceSurface(surface.id, 0, {
          intent: surface.intent,
          tree: surface.tree,
          data: surface.data,
          context: {},
        });
      } else if (change === "operations") {
        surfaces.applyOperations(surface.id, 0, [
          {
            type: "setProps",
            target: "buyer",
            props: { label: "Customer" },
          },
        ]);
      } else if (change === "confirmation") {
        surfaces.applyOperations(pending.confirmationSurface.id, 0, [
          {
            type: "setProps",
            target: pending.confirmationSurface.tree.id,
            props: { message: "Changed confirmation" },
          },
        ]);
      } else {
        surfaces.updateData(surface.id, 0, [
          {
            path: change === "readOnly" ? "tenant" : "buyer",
            value: change === "readOnly" ? "south" : "Bob",
          },
        ]);
      }
      expect(() => runtime.handleAction(oldConfirm)).toThrowError(
        expect.objectContaining({ code: "TOOL_CONFIRMATION_REQUIRED" }),
      );
      expect(requested).not.toHaveBeenCalled();
      expect(runtime.inspectInvocation(invocation.id).status).toBe("editing");
      if (change === "readOnly") {
        expect(() =>
          runtime.handleAction(
            action(surface.id, "tool.submit", invocation.id),
          ),
        ).toThrow(/Read-only field/);
        return;
      }
      const next = runtime.handleAction(
        action(surface.id, "tool.submit", invocation.id),
      );
      if (next.kind !== "confirmation-required")
        throw new Error("Expected fresh confirmation");
      expect(next.confirmationSurface.id).not.toBe(
        pending.confirmationSurface.id,
      );
      expect(() => runtime.handleAction(oldConfirm)).toThrowError(
        expect.objectContaining({ code: "TOOL_CONFIRMATION_REQUIRED" }),
      );
      const outcome = runtime.handleAction(
        action(next.confirmationSurface, "tool.submit", invocation.id, {
          confirmed: true,
        }),
      );
      expect(outcome).toMatchObject({
        kind: "invocation-requested",
        request: {
          validatedArguments: {
            buyer: change === "data" ? "Bob" : "Ada",
            password: "secret",
          },
        },
      });
      expect(requested).toHaveBeenCalledOnce();
      expect(
        runtime.handleAction(
          action(next.confirmationSurface, "tool.submit", invocation.id, {
            confirmed: true,
          }),
        ),
      ).toEqual(outcome);
      expect(requested).toHaveBeenCalledOnce();
    },
  );

  it("preflights duplicate invocation ids without leaving an orphan Surface", () => {
    const { runtime, surfaces } = runtimeFixture();
    runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "first-form",
      invocationId: "shared-invocation",
    });

    expect(() =>
      runtime.createToolSurface({
        toolId: "order.create",
        surfaceId: "orphan-form",
        invocationId: "shared-invocation",
      }),
    ).toThrowError(expect.objectContaining({ code: "INVOCATION_EXISTS" }));
    expect(surfaces.getSurface("orphan-form")).toBeUndefined();
  });

  it("preflights empty invocation metadata without leaving a Surface", () => {
    const { runtime, surfaces } = runtimeFixture();

    expect(() =>
      runtime.createToolSurface({
        toolId: "order.create",
        surfaceId: "empty-invocation-form",
        invocationId: "",
      }),
    ).toThrow(/Invocation id cannot be empty/);
    expect(surfaces.getSurface("empty-invocation-form")).toBeUndefined();

    expect(() =>
      runtime.createToolSurface({
        toolId: "order.create",
        surfaceId: "empty-correlation-form",
        correlationId: "",
      }),
    ).toThrow(/correlationId cannot be empty/);
    expect(surfaces.getSurface("empty-correlation-form")).toBeUndefined();
  });

  it("isolates event and request listener failures", () => {
    const components = createStandardComponentRegistry();
    const surfaces = new InMemorySurfaceStore(components);
    const listenerErrors: Array<{ channel: string; message: string }> = [];
    const runtime = new ToolToUIRuntime(components, surfaces, {
      onListenerError(error, channel) {
        listenerErrors.push({
          channel,
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });
    runtime.registerTool({
      id: "safe.read",
      version: "1.0.0",
      inputSchema: { type: "object" },
    });
    runtime.subscribe(() => {
      throw new Error("event observer failed");
    });
    const healthyEventListener = vi.fn();
    runtime.subscribe(healthyEventListener);
    runtime.onInvocationRequested(() => {
      throw new Error("request observer failed");
    });
    const healthyRequestListener = vi.fn();
    runtime.onInvocationRequested(healthyRequestListener);
    const created = runtime.createToolSurface({
      toolId: "safe.read",
      surfaceId: "safe-form",
    });

    const outcome = runtime.handleAction(
      action(created.surface.id, "tool.submit", created.invocation.id),
    );

    expect(outcome.kind).toBe("invocation-requested");
    expect(healthyEventListener).toHaveBeenCalled();
    expect(healthyRequestListener).toHaveBeenCalledOnce();
    expect(listenerErrors).toEqual(
      expect.arrayContaining([
        { channel: "event", message: "event observer failed" },
        { channel: "request", message: "request observer failed" },
      ]),
    );
  });

  it("rejects an out-of-order result without creating result state", () => {
    const { runtime, surfaces } = runtimeFixture();
    const created = runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "early-result-form",
    });

    expect(() =>
      runtime.resolveInvocation(created.invocation.id, { orderId: "early" }),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_INVOCATION_TRANSITION" }),
    );
    expect(runtime.getRawResult(created.invocation.id)).toBeUndefined();
    expect(
      surfaces.getSurface(`${created.surface.id}--result-0`),
    ).toBeUndefined();
  });

  it("releases Runtime-owned Surface subscriptions", () => {
    const components = createStandardComponentRegistry();
    const surfaces = new InMemorySurfaceStore(components);
    const originalSubscribe = surfaces.subscribe.bind(surfaces);
    let activeSubscriptions = 0;
    vi.spyOn(surfaces, "subscribe").mockImplementation(
      (surfaceId, listener) => {
        activeSubscriptions += 1;
        const unsubscribe = originalSubscribe(surfaceId, listener);
        return () => {
          activeSubscriptions -= 1;
          unsubscribe();
        };
      },
    );
    const runtime = new ToolToUIRuntime(components, surfaces);
    runtime.registerTool({
      id: "safe.read",
      version: "1.0.0",
      inputSchema: { type: "object" },
    });
    const first = runtime.createToolSurface({
      toolId: "safe.read",
      surfaceId: "first-release-form",
    });
    runtime.createToolSurface({
      toolId: "safe.read",
      surfaceId: "second-release-form",
    });
    expect(activeSubscriptions).toBe(2);

    runtime.disposeInvocation(first.invocation.id);
    expect(activeSubscriptions).toBe(1);
    runtime.dispose();
    runtime.dispose();
    expect(activeSubscriptions).toBe(0);
  });

  it("validates, confirms, redacts events, and emits a host request without executing it", () => {
    const { runtime, surfaces } = runtimeFixture();
    const events: ToolRuntimeEvent[] = [];
    const requests: ToolSubmissionRequest[] = [];
    const hostExecute = vi.fn();
    runtime.subscribe((event) => events.push(event));
    runtime.onInvocationRequested((request) => requests.push(request));
    const { invocation, surface } = runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "order-form",
      initialValues: { buyer: "Ada", password: "secret", tenant: "north" },
    });

    const first = runtime.handleAction(
      action(surface.id, "tool.submit", invocation.id),
    );
    expect(first.kind).toBe("confirmation-required");
    const confirmation =
      first.kind === "confirmation-required"
        ? first.confirmationSurface
        : undefined;
    expect(confirmation?.tree.component).toBe("Dialog");
    expect(
      events.find((event) => event.type === "tool.confirmationRequested")
        ?.redactedArguments,
    ).toEqual({
      buyer: "Ada",
      password: "[REDACTED]",
    });

    const submitted = runtime.handleAction(
      action(confirmation!, "tool.submit", invocation.id, {
        confirmed: true,
      }),
    );
    expect(submitted.kind).toBe("invocation-requested");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.validatedArguments).toEqual({
      buyer: "Ada",
      password: "secret",
    });
    expect(requests[0]?.toolVersion).toBe("1.0.0");
    expect(requests[0]?.idempotencyKey).toBe(`${invocation.id}:1`);
    expect(hostExecute).not.toHaveBeenCalled();
    expect(surfaces.requireSurface(surface.id).tree.props.submitting).toBe(
      true,
    );
    const duplicate = runtime.handleAction(
      action(surface.id, "tool.submit", invocation.id),
    );
    expect(duplicate).toEqual(submitted);
    expect(requests).toHaveLength(1);

    runtime.markInvocationStarted(invocation.id);
    const resolved = runtime.resolveInvocation(invocation.id, {
      orderId: "PO-1",
    });
    expect(resolved.status).toBe("success");
    expect(resolved.resultSurfaceId).toBe("order-form--result-1");
    expect(
      runtime.actionStateSource.getSnapshot(confirmation!.id).states[0],
    ).toMatchObject({
      status: "succeeded",
      attempt: 1,
      idempotencyKey: `${invocation.id}:1`,
    });
    expect(runtime.getRawResult(invocation.id)).toEqual({ orderId: "PO-1" });
    const raw = runtime.getRawResult(invocation.id) as { orderId: string };
    raw.orderId = "tampered";
    expect(runtime.getRawResult(invocation.id)).toEqual({ orderId: "PO-1" });
    const resultSurface = surfaces.requireSurface(resolved.resultSurfaceId!);
    surfaces.applyOperations(resultSurface.id, resultSurface.revision, [
      {
        type: "setVisibility",
        target: "result.orderId",
        visible: false,
      },
    ]);
    expect(runtime.getRawResult(invocation.id)).toEqual({ orderId: "PO-1" });
    expect(surfaces.requireSurface(surface.id).tree.props.submitting).toBe(
      false,
    );
  });

  it("resolves nested array results into a valid result Surface", () => {
    const components = createStandardComponentRegistry();
    const surfaces = new InMemorySurfaceStore(components);
    const runtime = new ToolToUIRuntime(components, surfaces);
    runtime.registerTool({
      id: "tea.search",
      version: "1.0.0",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
      outputSchema: {
        type: "object",
        required: ["teas"],
        properties: {
          teas: { type: "array", items: { type: "string" } },
        },
      },
    });
    const requests: ToolSubmissionRequest[] = [];
    runtime.onInvocationRequested((request) => requests.push(request));
    const { invocation, surface } = runtime.createToolSurface({
      toolId: "tea.search",
      surfaceId: "tea-search",
      initialValues: { query: "green" },
    });

    const outcome = runtime.handleAction(
      action(surface.id, "tool.submit", invocation.id),
    );
    expect(outcome.kind).toBe("invocation-requested");
    runtime.markInvocationStarted(invocation.id);
    const resolved = runtime.resolveInvocation(invocation.id, {
      teas: ["Longjing"],
    });

    expect(requests).toHaveLength(1);
    expect(resolved.status).toBe("success");
    const resultSurface = surfaces.requireSurface(resolved.resultSurfaceId!);
    const group = resultSurface.tree.children?.[0];
    expect(group?.component).toBe("Accordion");
    expect(group?.id).not.toBe(group?.children?.[0]?.id);
    expect(group?.children?.[0]?.stableId).toBe("result.teas");
  });

  it("reports invalid input and rejects read-only tampering", () => {
    const { runtime, surfaces } = runtimeFixture();
    const events: ToolRuntimeEvent[] = [];
    runtime.subscribe((event) => events.push(event));
    const missing = runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "missing-form",
      initialValues: { password: "secret", tenant: "north" },
    });
    expect(() =>
      runtime.handleAction(
        action(missing.surface.id, "tool.submit", missing.invocation.id),
      ),
    ).toThrow(/does not match/);
    expect(runtime.inspectInvocation(missing.invocation.id).status).toBe(
      "editing",
    );
    expect(events.some((event) => event.type === "tool.validationFailed")).toBe(
      true,
    );

    const tampered = runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "tampered-form",
      initialValues: { buyer: "Ada", password: "secret", tenant: "north" },
    });
    const current = surfaces.requireSurface(tampered.surface.id);
    surfaces.updateData(current.id, current.revision, [
      { path: "tenant", value: "south" },
    ]);
    expect(() =>
      runtime.handleAction(
        action(current.id, "tool.submit", tampered.invocation.id),
      ),
    ).toThrow(/Read-only field/);
  });

  it.each([
    { policy: "safe", retryable: false, allowed: false },
    { policy: "safe", retryable: true, allowed: true },
    { policy: "safe", retryable: undefined, allowed: true },
    { policy: "never", retryable: true, allowed: false },
  ] as const)(
    "enforces retry policy $policy and host failure retryable=$retryable",
    ({ policy, retryable, allowed }) => {
      const components = createStandardComponentRegistry();
      const surfaces = new InMemorySurfaceStore(components);
      const runtime = new ToolToUIRuntime(components, surfaces);
      runtime.registerTool({
        id: "safe.read",
        version: "1.0.0",
        inputSchema: { type: "object" },
        annotations: { retry: policy },
      });
      const requested = vi.fn();
      runtime.onInvocationRequested(requested);
      const { invocation, surface } = runtime.createToolSurface({
        toolId: "safe.read",
        surfaceId: "retry-policy",
      });
      runtime.handleAction(action(surface, "tool.submit", invocation.id));
      const failed = runtime.rejectInvocation(invocation.id, {
        code: "HOST_FAILURE",
        message: "Host rejected the request",
        ...(retryable === undefined ? {} : { retryable }),
      });
      const before = surfaces.requireSurface(surface.id);
      if (allowed) {
        expect(
          runtime.handleAction(action(surface, "tool.retry", invocation.id)),
        ).toMatchObject({
          kind: "invocation-requested",
          invocation: { attempt: 2 },
          request: { idempotencyKey: failed.lastIdempotencyKey },
        });
        // Eligibility is attached to the latest failure, not permanently to the Tool.
        runtime.rejectInvocation(invocation.id, {
          code: "PERMANENT",
          message: "Stop retrying",
          retryable: false,
        });
        expect(() =>
          runtime.handleAction(action(surface, "tool.retry", invocation.id)),
        ).toThrowError(
          expect.objectContaining({ code: "TOOL_RETRY_NOT_ALLOWED" }),
        );
        expect(requested).toHaveBeenCalledTimes(2);
      } else {
        expect(() =>
          runtime.handleAction(action(surface, "tool.retry", invocation.id)),
        ).toThrowError(
          expect.objectContaining({ code: "TOOL_RETRY_NOT_ALLOWED" }),
        );
        expect(runtime.inspectInvocation(invocation.id)).toEqual(failed);
        expect(surfaces.requireSurface(surface.id)).toEqual(before);
        expect(requested).toHaveBeenCalledOnce();
      }
    },
  );

  it("retries only safe failures with the same idempotency key", () => {
    const { runtime, surfaces } = runtimeFixture();
    const created = runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "retry-form",
      initialValues: { buyer: "Ada", password: "secret", tenant: "north" },
    });
    const confirmation = runtime.handleAction(
      action(created.surface.id, "tool.submit", created.invocation.id),
    );
    if (confirmation.kind !== "confirmation-required")
      throw new Error("confirmation expected");
    const submitted = runtime.handleAction(
      action(
        confirmation.confirmationSurface,
        "tool.submit",
        created.invocation.id,
        { confirmed: true },
      ),
    );
    if (submitted.kind !== "invocation-requested")
      throw new Error("request expected");
    expect(
      runtime.actionStateSource.getSnapshot(confirmation.confirmationSurface.id)
        .states[0],
    ).toMatchObject({
      status: "pending",
      attempt: 1,
      idempotencyKey: submitted.request.idempotencyKey,
    });
    runtime.rejectInvocation(created.invocation.id, {
      code: "TEMPORARY",
      message: "Try again",
    });
    expect(
      runtime.actionStateSource.getSnapshot(confirmation.confirmationSurface.id)
        .states[0],
    ).toMatchObject({
      status: "failed",
      error: { code: "TEMPORARY" },
    });
    expect(
      runtime.inspectInvocation(created.invocation.id).resultSurfaceId,
    ).toBe("retry-form--result-1");
    const edited = surfaces.requireSurface(created.surface.id);
    surfaces.updateData(edited.id, edited.revision, [
      { path: "buyer", value: "Changed after failure" },
    ]);
    const retried = runtime.handleAction(
      action(created.surface.id, "tool.retry", created.invocation.id),
    );
    expect(retried.kind).toBe("invocation-requested");
    if (retried.kind === "invocation-requested") {
      expect(retried.request.idempotencyKey).toBe(
        submitted.request.idempotencyKey,
      );
      expect(retried.invocation.attempt).toBe(2);
      expect(retried.request.validatedArguments).toEqual(
        submitted.request.validatedArguments,
      );
      expect(
        runtime.actionStateSource.getSnapshot(created.surface.id).states[0],
      ).toMatchObject({ status: "pending", attempt: 2 });
    }
  });

  it("projects Tool cancellation from the authoritative invocation", () => {
    const { runtime } = runtimeFixture();
    const created = runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "cancel-form",
      initialValues: { buyer: "Ada", password: "secret", tenant: "north" },
    });
    const confirmation = runtime.handleAction(
      action(created.surface.id, "tool.submit", created.invocation.id),
    );
    if (confirmation.kind !== "confirmation-required")
      throw new Error("confirmation expected");
    const submitted = runtime.handleAction(
      action(
        confirmation.confirmationSurface,
        "tool.submit",
        created.invocation.id,
        { confirmed: true },
      ),
    );
    if (submitted.kind !== "invocation-requested")
      throw new Error("request expected");

    const cancelled = runtime.handleAction(
      action(
        confirmation.confirmationSurface,
        "tool.cancel",
        created.invocation.id,
      ),
    );
    expect(cancelled).toMatchObject({
      kind: "state-changed",
      invocation: { status: "cancelled" },
    });
    expect(
      runtime.actionStateSource.getSnapshot(confirmation.confirmationSurface.id)
        .states[0],
    ).toMatchObject({ status: "cancelled", attempt: 1 });
  });

  it("migrates aliased values and emits type conflicts", () => {
    const { runtime } = runtimeFixture();
    const events: ToolRuntimeEvent[] = [];
    runtime.subscribe((event) => events.push(event));
    const created = runtime.createToolSurface({
      toolId: "order.create",
      surfaceId: "migration-form",
      initialValues: { buyer: "Ada", password: "secret", tenant: "north" },
    });
    const migrated = runtime.replaceToolSurface(
      created.invocation.id,
      {
        intent: "form",
        schemaRef: { id: "order.create", version: "1.0.0" },
        tree: {
          id: "replacement-root",
          component: "Form",
          props: {},
          children: [
            {
              id: "customer",
              stableId: "customer",
              component: "TextInput",
              props: { label: "Customer" },
              binding: { path: "customer", valueType: "string" },
            },
            {
              id: "password-count",
              stableId: "password",
              component: "NumberInput",
              props: { label: "Password count" },
              binding: { path: "passwordCount", valueType: "number" },
            },
          ],
        },
        data: { customer: "Default", passwordCount: 0 },
        context: { source: "tool.input" },
      },
      { buyer: "customer" },
    );

    expect(migrated.surface.data.customer).toBe("Ada");
    expect(migrated.conflicts).toEqual([
      expect.objectContaining({
        code: "TYPE_INCOMPATIBLE",
        previousStableId: "password",
      }),
    ]);
    expect(
      events.some((event) => event.type === "ui.dataMigrationConflict"),
    ).toBe(true);
  });

  it("rejects unregistered tools and version conflicts", () => {
    const { runtime } = runtimeFixture();
    expect(() =>
      runtime.createToolSurface({ toolId: "missing", surfaceId: "missing" }),
    ).toThrow(/not registered/);
    expect(() =>
      runtime.createToolSurface({
        toolId: "order.create",
        toolVersion: "2.0.0",
        surfaceId: "wrong-version",
      }),
    ).toThrow(/version 1.0.0/);
  });
});
