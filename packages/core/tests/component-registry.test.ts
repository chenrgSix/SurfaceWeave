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

  it("keeps compiled validators isolated from caller-owned schemas", () => {
    const registry = new InMemoryComponentRegistry();
    const definition = {
      type: "Label",
      propsSchema: {
        type: "object" as const,
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string" as const } },
      },
    };
    registry.register(definition);

    definition.propsSchema.properties.text.type = "number" as never;
    const returned = registry.require("Label");
    if (returned.propsSchema !== undefined && returned.propsSchema !== true) {
      returned.propsSchema = { type: "number" };
    }

    expect(() =>
      registry.assertNode({
        id: "label",
        component: "Label",
        props: { text: "safe" },
      }),
    ).not.toThrow();
    expect(() =>
      registry.assertNode({
        id: "label",
        component: "Label",
        props: { text: 42 },
      }),
    ).toThrow(/does not match its JSON Schema/);
  });

  it("rejects invalid extension schemas during registration", () => {
    const registry = new InMemoryComponentRegistry();

    expect(() =>
      registry.register({
        type: "Extended",
        extensions: {
          "example.invalid": {
            version: "1.0.0",
            schema: { required: "name" } as never,
          },
        },
      }),
    ).toThrow(/not a valid JSON Schema 2020-12/);
    expect(registry.has("Extended")).toBe(false);
  });
});
