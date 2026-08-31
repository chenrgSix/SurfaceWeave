import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionIntent } from "@surfaceweave/core";

import { OperationsDemo } from "../src/demo-runtime.js";

const demos: OperationsDemo[] = [];
function fixture() {
  const demo = new OperationsDemo(100);
  demos.push(demo);
  demo.start();
  expect(demo.getSnapshot().notice).toBeNull();
  expect(demo.getSnapshot().surfaceId).not.toBeNull();
  return demo;
}
function input(demo: OperationsDemo, values: Record<string, string | boolean>) {
  const surface = demo.store.requireSurface(demo.getSnapshot().surfaceId!);
  demo.store.updateData(
    surface.id,
    surface.revision,
    Object.entries(values).map(([path, value]) => ({ path, value })),
  );
}
function submit(demo: OperationsDemo, confirm = false): ActionIntent {
  const state = demo.getSnapshot();
  const surface = demo.store.requireSurface(
    confirm ? state.confirmationId! : state.surfaceId!,
  );
  const intent: ActionIntent = {
    id: `test-${surface.id}-${surface.revision}`,
    surfaceId: surface.id,
    nodeId: surface.tree.id,
    action: "tool.submit",
    input: {
      invocationId: state.invocation!.id,
      ...(confirm ? { confirmed: true } : {}),
    },
  };
  demo.handleAction(intent);
  return intent;
}

afterEach(() => {
  for (const demo of demos.splice(0)) demo.dispose();
  vi.useRealTimers();
});

describe("operations center scenario", () => {
  it("restructures a generated tool Surface without losing edited data or stable bindings", () => {
    const demo = fixture();
    input(demo, { note: "这是用户刚刚输入的交接信息", route: "relay" });
    const before = demo.store.requireSurface(demo.getSnapshot().surfaceId!);
    demo.reorganize();
    const after = demo.store.requireSurface(before.id);
    expect(demo.getSnapshot()).toMatchObject({
      reorganized: true,
      preserved: true,
      notice: null,
    });
    expect(after.data).toEqual(before.data);
    expect(after.tree.children?.[0]?.id).toBe("decision-gate");
    expect(
      after.tree.children?.find((node) => node.stableId === "route"),
    ).toMatchObject({
      component: "RouteComparison",
      binding: { path: "route", valueType: "string" },
    });
  });

  it("rejects the whole constraint-breaking batch and an older revision", () => {
    const demo = fixture();
    const before = demo.store.requireSurface(demo.getSnapshot().surfaceId!);
    demo.challenge("constraint");
    demo.challenge("revision");
    expect(demo.getSnapshot().checks).toEqual(["constraint", "revision"]);
    expect(demo.store.requireSurface(before.id)).toEqual(before);
    expect(demo.getSnapshot().hostRequests).toEqual([]);
  });

  it("requires approval and a fresh confirmation after an input edit", () => {
    const demo = fixture();
    submit(demo);
    expect(demo.getSnapshot().confirmationId).toBeNull();
    expect(demo.getSnapshot().hostRequests).toHaveLength(0);
    input(demo, { approval: true });
    submit(demo);
    const old = demo.store.requireSurface(demo.getSnapshot().confirmationId!);
    input(demo, { route: "relay" });
    expect(demo.getSnapshot().confirmationId).toBeNull();
    demo.handleAction({
      id: "stale-confirmation",
      surfaceId: old.id,
      nodeId: old.tree.id,
      action: "tool.submit",
      input: {
        confirmed: true,
        invocationId: demo.getSnapshot().invocation!.id,
      },
    });
    expect(demo.getSnapshot().hostRequests).toHaveLength(0);
    submit(demo);
    expect(demo.getSnapshot().confirmationId).not.toBe(old.id);
    submit(demo, true);
    expect(demo.getSnapshot().hostRequests[0]?.validatedArguments.route).toBe(
      "relay",
    );
  });

  it("recovers from the simulated failure with one key and the confirmed arguments", () => {
    vi.useFakeTimers();
    const demo = fixture();
    input(demo, { approval: true });
    submit(demo);
    const intent = submit(demo, true);
    expect(demo.getSnapshot().notice).toBeNull();
    demo.handleAction(intent);
    expect(demo.getSnapshot().hostRequests).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(demo.getSnapshot().invocation?.status).toBe("error");
    const original = demo.getSnapshot().hostRequests[0]!;
    input(demo, { route: "relay" });
    demo.retry();
    const retried = demo.getSnapshot().hostRequests[1]!;
    expect(retried.idempotencyKey).toBe(original.idempotencyKey);
    expect(retried.validatedArguments).toEqual(original.validatedArguments);
    vi.advanceTimersByTime(100);
    expect(demo.getSnapshot().invocation?.status).toBe("success");
    expect(demo.getSnapshot().receipt).toMatchObject({
      orderId: "REC-2026-0842",
      route: "air",
    });
    expect(
      demo.store.requireSurface(demo.getSnapshot().invocation!.resultSurfaceId!)
        .context.source,
    ).toBe("tool.result");
  });

  it("disposes pending host work when the demo is reset", () => {
    vi.useFakeTimers();
    const demo = fixture();
    input(demo, { approval: true });
    submit(demo);
    submit(demo, true);
    demo.dispose();
    const snapshot = demo.getSnapshot();
    vi.runAllTimers();
    expect(demo.getSnapshot()).toBe(snapshot);
  });
});
