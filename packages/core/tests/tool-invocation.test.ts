import { InMemoryToolInvocationStore } from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("InMemoryToolInvocationStore", () => {
  it("enforces the invocation state machine", () => {
    const store = new InMemoryToolInvocationStore();
    store.create({
      id: "inv-1",
      toolId: "tea.search",
      toolVersion: "1",
      sourceSurfaceId: "search-form",
      correlationId: "corr-1",
      status: "editing",
    });

    expect(store.transition("inv-1", "validating").revision).toBe(1);
    expect(store.transition("inv-1", "submitting", { attempt: 1 }).status).toBe(
      "submitting",
    );
    expect(store.transition("inv-1", "success").status).toBe("success");
    expect(() => store.transition("inv-1", "editing")).toThrow(
      /cannot transition/,
    );
  });
});
