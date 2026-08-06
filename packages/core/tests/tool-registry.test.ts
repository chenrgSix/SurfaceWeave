import { InMemoryToolRegistry } from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("InMemoryToolRegistry", () => {
  it("stores cloned, deterministically ordered definitions", () => {
    const registry = new InMemoryToolRegistry();
    registry.register({
      id: "tea.search",
      version: "1.0.0",
      inputSchema: { type: "object" },
    });
    registry.register({
      id: "order.create",
      version: "2.0.0",
      inputSchema: { type: "object" },
    });

    expect(registry.list().map((tool) => tool.id)).toEqual([
      "order.create",
      "tea.search",
    ]);
    expect(registry.require("tea.search", "1.0.0").id).toBe("tea.search");
  });

  it("rejects duplicates, version conflicts, and weakened side-effect policy", () => {
    const registry = new InMemoryToolRegistry();
    registry.register({ id: "order.create", version: "1", inputSchema: true });
    expect(() =>
      registry.register({
        id: "order.create",
        version: "2",
        inputSchema: true,
      }),
    ).toThrow(/already registered/);
    expect(() => registry.require("order.create", "2")).toThrow(/version 1/);
    expect(() =>
      registry.register({
        id: "unsafe.create",
        version: "1",
        inputSchema: true,
        annotations: { sideEffect: true, confirmation: "never" },
      }),
    ).toThrow(/cannot disable confirmation/);
  });
});
