import type { ActionIntent } from "@surfaceweave/core";
import { describe, expect, it, vi } from "vitest";

import { TauriActionExecutor, type TauriInvoke } from "../src/index.js";

function mockInvoke(output: unknown = undefined): {
  invoke: TauriInvoke;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(async (command: string, args?: Record<string, unknown>) => {
    void command;
    void args;
    return structuredClone(output);
  });
  const invoke: TauriInvoke = async <T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> => (await spy(command, args)) as T;
  return { invoke, spy };
}

function intent(overrides: Partial<ActionIntent> = {}): ActionIntent {
  return {
    id: "intent-1",
    surfaceId: "tea-selection",
    nodeId: "native-actions",
    action: "tea.search",
    input: { query: "green" },
    idempotencyKey: "search-once",
    ...overrides,
  };
}

describe("TauriActionExecutor", () => {
  it("routes a registered semantic action to its trusted handler", async () => {
    const { invoke, spy } = mockInvoke(["longjing"]);
    const executor = new TauriActionExecutor(invoke);
    executor.register("tea.search", async (input, context) =>
      context.invoke("search_teas", { input }),
    );

    const result = await executor.execute(intent());

    expect(spy).toHaveBeenCalledWith("search_teas", {
      input: { query: "green" },
    });
    expect(result).toEqual({
      intentId: "intent-1",
      status: "success",
      output: ["longjing"],
    });
  });

  it("rejects unregistered actions without invoking Tauri", async () => {
    const { invoke, spy } = mockInvoke();
    const executor = new TauriActionExecutor(invoke);

    const result = await executor.execute(intent({ action: "desktop.shell" }));

    expect(result).toMatchObject({
      status: "error",
      error: { code: "UNKNOWN_ACTION" },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not let input inject a Rust command or URL", async () => {
    const { invoke, spy } = mockInvoke();
    const handler = vi.fn();
    const executor = new TauriActionExecutor(invoke);
    executor.register("tea.search", handler);

    for (const input of [
      { command: "run_shell" },
      { nested: { rustCommand: "delete_everything" } },
      { url: "https://untrusted.example" },
    ]) {
      const result = await executor.execute(intent({ input }));
      expect(result).toMatchObject({
        status: "error",
        error: { code: "INVALID_ACTION_INPUT" },
      });
    }
    expect(handler).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it("converts handler failures into structured ActionResult values", async () => {
    const executor = new TauriActionExecutor(mockInvoke().invoke);
    executor.register("tea.search", () => {
      throw new Error("database password must not escape");
    });

    const result = await executor.execute(intent());

    expect(result).toEqual({
      intentId: "intent-1",
      status: "error",
      error: {
        code: "ACTION_HANDLER_FAILED",
        message: 'Action "tea.search" failed in its registered handler',
      },
    });
  });

  it("preserves trace identity and idempotency for the handler", async () => {
    let received: ActionIntent | undefined;
    const executor = new TauriActionExecutor(mockInvoke(null).invoke);
    executor.register("tea.search", (_input, context) => {
      received = context.intent;
      return null;
    });

    const request = intent();
    await executor.execute(request);

    expect(received).toEqual(request);
    expect(received).not.toBe(request);
  });

  it("returns structured validation and authorization failures", async () => {
    const executor = new TauriActionExecutor(mockInvoke(null).invoke);
    executor.register("purchase.create", () => null, {
      validate: (input) => {
        if (
          typeof input !== "object" ||
          input === null ||
          !("quantity" in input) ||
          typeof input.quantity !== "number"
        ) {
          throw new Error("quantity is required");
        }
      },
      authorize: () => false,
    });

    const invalid = await executor.execute(
      intent({ action: "purchase.create", input: {} }),
    );
    const unauthorized = await executor.execute(
      intent({ action: "purchase.create", input: { quantity: 1 } }),
    );

    expect(invalid).toMatchObject({
      status: "error",
      error: { code: "INVALID_ACTION_INPUT" },
    });
    expect(unauthorized).toMatchObject({
      status: "error",
      error: { code: "ACTION_NOT_AUTHORIZED" },
    });
  });
});
