import { describe, expect, it } from "vitest";

import { InMemoryComponentRegistry } from "../src/index.js";
import type { DynamicUIError } from "../src/index.js";

describe("InMemoryComponentRegistry", () => {
  it("rejects unknown components", () => {
    const registry = new InMemoryComponentRegistry();

    expect(() => registry.require("RemoteWidget")).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "UNKNOWN_COMPONENT",
      }),
    );
  });

  it("returns defensive copies", () => {
    const registry = new InMemoryComponentRegistry();
    registry.register({ type: "Text", actions: ["press"] });

    const copy = registry.require("Text");
    copy.actions?.push("unsafe");

    expect(registry.require("Text").actions).toEqual(["press"]);
  });
});
