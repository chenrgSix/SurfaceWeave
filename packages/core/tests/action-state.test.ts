import {
  InMemoryActionExecutionController,
  type ActionExecutor,
  type ActionIntent,
  type ActionResult,
} from "../src/index.js";
import { describe, expect, it, vi } from "vitest";

function intent(overrides: Partial<ActionIntent> = {}): ActionIntent {
  return {
    id: "intent-1",
    surfaceId: "surface-1",
    nodeId: "submit",
    action: "purchase.submit",
    input: { buyer: "Ada" },
    idempotencyKey: "purchase-1",
    ...overrides,
  };
}

describe("InMemoryActionExecutionController", () => {
  it("projects pending to success and coalesces the same in-flight key", async () => {
    let resolveResult: ((result: ActionResult) => void) | undefined;
    const executor: ActionExecutor = {
      execute: vi.fn(
        () =>
          new Promise<ActionResult>((resolve) => {
            resolveResult = resolve;
          }),
      ),
    };
    let now = 10;
    const controller = new InMemoryActionExecutionController(executor, {
      now: () => now,
    });
    const snapshots: string[] = [];
    controller.subscribe("surface-1", (snapshot) =>
      snapshots.push(snapshot.states[0]?.status ?? "none"),
    );

    const first = controller.execute(intent());
    const duplicate = controller.execute(intent({ id: "intent-duplicate" }));
    expect(duplicate).toBe(first);
    expect(executor.execute).toHaveBeenCalledOnce();
    expect(controller.getSnapshot("surface-1").states[0]).toMatchObject({
      status: "pending",
      attempt: 1,
      startedAt: 10,
    });

    now = 20;
    resolveResult?.({ intentId: "intent-1", status: "success" });
    await expect(first).resolves.toMatchObject({ status: "success" });
    expect(controller.getSnapshot("surface-1").states[0]).toMatchObject({
      status: "succeeded",
      settledAt: 20,
    });
    expect(snapshots).toEqual(["pending", "succeeded"]);
  });

  it("treats resolved ActionResult errors as failed and retries original input", async () => {
    const inputs: unknown[] = [];
    const executor: ActionExecutor = {
      async execute(value) {
        inputs.push(value.input);
        return inputs.length === 1
          ? {
              intentId: value.id,
              status: "error",
              error: { code: "BUSINESS_REJECTED", message: "No stock" },
            }
          : { intentId: value.id, status: "success" };
      },
    };
    const controller = new InMemoryActionExecutionController(executor);
    const original = intent();
    await controller.execute(original);
    (original.input as { buyer: string }).buyer = "Tampered";
    expect(controller.getSnapshot("surface-1").states[0]).toMatchObject({
      status: "failed",
      error: { code: "BUSINESS_REJECTED" },
    });

    await expect(controller.retry("purchase-1")).resolves.toMatchObject({
      status: "success",
    });
    expect(inputs).toEqual([{ buyer: "Ada" }, { buyer: "Ada" }]);
    expect(controller.getSnapshot("surface-1").states[0]).toMatchObject({
      status: "succeeded",
      attempt: 2,
      idempotencyKey: "purchase-1",
    });
  });

  it("cancels pending work and blocks execution while interaction is disabled", async () => {
    let release: (() => void) | undefined;
    const executor: ActionExecutor = {
      execute: vi.fn(
        () =>
          new Promise<ActionResult>((resolve) => {
            release = () =>
              resolve({ intentId: "intent-1", status: "success" });
          }),
      ),
    };
    const controller = new InMemoryActionExecutionController(executor);
    const pending = controller.execute(intent());
    expect(controller.cancel("purchase-1").status).toBe("cancelled");
    await expect(pending).resolves.toMatchObject({ status: "cancelled" });
    release?.();
    await Promise.resolve();
    expect(controller.getSnapshot("surface-1").states[0]?.status).toBe(
      "cancelled",
    );

    controller.setInteractionDisabled("surface-2", true);
    await expect(
      controller.execute(
        intent({
          id: "intent-2",
          surfaceId: "surface-2",
          idempotencyKey: "purchase-2",
        }),
      ),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "ACTION_INTERACTION_DISABLED" },
    });
    expect(executor.execute).toHaveBeenCalledOnce();
    expect(controller.getSnapshot("surface-2").interactionDisabled).toBe(true);
  });
});
