import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  type ActionIntent,
  type ToolRuntimeEvent,
  type ToolSubmissionRequest,
} from "@package-first/core";
import { describe, expect, it, vi } from "vitest";

import { ToolToUIRuntime } from "../src/index.js";

function action(
  surfaceId: string,
  actionName: string,
  invocationId: string,
  extra: Record<string, string | boolean> = {},
): ActionIntent {
  return {
    id: `${invocationId}-${actionName}`,
    surfaceId,
    nodeId: `${surfaceId}--root`,
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
      action(confirmation!.id, "tool.submit", invocation.id, {
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
    expect(() =>
      runtime.handleAction(action(surface.id, "tool.submit", invocation.id)),
    ).toThrow(/already submitting/);

    runtime.markInvocationStarted(invocation.id);
    expect(
      runtime.resolveInvocation(invocation.id, { orderId: "PO-1" }).status,
    ).toBe("success");
    expect(surfaces.requireSurface(surface.id).tree.props.submitting).toBe(
      false,
    );
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

  it("retries only safe failures with the same idempotency key", () => {
    const { runtime } = runtimeFixture();
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
        confirmation.confirmationSurface.id,
        "tool.submit",
        created.invocation.id,
        { confirmed: true },
      ),
    );
    if (submitted.kind !== "invocation-requested")
      throw new Error("request expected");
    runtime.rejectInvocation(created.invocation.id, {
      code: "TEMPORARY",
      message: "Try again",
    });
    const retried = runtime.handleAction(
      action(created.surface.id, "tool.retry", created.invocation.id),
    );
    expect(retried.kind).toBe("invocation-requested");
    if (retried.kind === "invocation-requested") {
      expect(retried.request.idempotencyKey).toBe(
        submitted.request.idempotencyKey,
      );
      expect(retried.invocation.attempt).toBe(2);
    }
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
