import { createStandardComponentRegistry } from "@package-first/core";
import type { DynamicUIError } from "@package-first/core";
import { describe, expect, it } from "vitest";

import { generateSurface } from "../src/index.js";
import type { GenerateSurfaceInput, SimpleJsonSchema } from "../src/index.js";

const formSchema: SimpleJsonSchema = {
  type: "object",
  title: "Purchase",
  required: ["buyer"],
  properties: {
    remark: { type: "string", title: "Remark" },
    quantity: { type: "integer", default: 1 },
    buyer: { type: "string", title: "Buyer" },
  },
};

const collectionSchema: SimpleJsonSchema = {
  type: "object",
  title: "Tea catalog",
  properties: {
    teas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
};

describe("generateSurface", () => {
  it("is deterministic and does not mutate input", () => {
    const registry = createStandardComponentRegistry();
    const input: GenerateSurfaceInput = {
      surfaceId: "purchase",
      schema: formSchema,
      intent: "form",
      data: { buyer: "Ada" },
      metadata: {
        fields: {
          buyer: { order: -1 },
        },
      },
    };
    const before = structuredClone(input);

    const first = generateSurface(input, registry);
    const second = generateSurface(input, registry);

    expect(first).toEqual(second);
    expect(input).toEqual(before);
    expect(first.tree.children?.map((node) => node.stableId)).toEqual([
      "buyer",
      "quantity",
      "remark",
    ]);
    expect(first.data).toEqual({ buyer: "Ada", quantity: 1 });
  });

  it.each(["browse", "single-select", "multi-select"] as const)(
    "generates a trusted collection for %s",
    (intent) => {
      const registry = createStandardComponentRegistry();
      const surface = generateSurface(
        {
          surfaceId: `tea-${intent}`,
          schema: collectionSchema,
          intent,
          data: {
            teas: [
              { id: "longjing", name: "Longjing" },
              { id: "tieguanyin", name: "Tieguanyin" },
            ],
            selection: [],
          },
          metadata: { itemsPath: "teas", selectionPath: "selection" },
        },
        registry,
      );

      expect(registry.has(surface.tree.component)).toBe(true);
      expect(surface.tree.component).toBe(
        intent === "browse" ? "Table" : "CardList",
      );
      expect(surface.tree.props.items).toHaveLength(2);
      expect(surface.tree.binding?.path).toBe(
        intent === "browse" ? "teas" : "selection",
      );
    },
  );

  it("generates a trusted confirmation surface", () => {
    const registry = createStandardComponentRegistry();
    const surface = generateSurface(
      {
        surfaceId: "confirm-order",
        schema: { type: "object", title: "Submit order" },
        intent: "confirm",
        data: { quantity: 2 },
      },
      registry,
    );

    expect(surface.tree.component).toBe("Confirm");
    expect(surface.tree.props.summary).toEqual({ quantity: 2 });
  });

  it("rejects developer metadata that names an unknown component", () => {
    expect(() =>
      generateSurface(
        {
          surfaceId: "unsafe",
          schema: formSchema,
          intent: "form",
          data: {},
          metadata: { rootComponent: "GeneratedReactCode" },
        },
        createStandardComponentRegistry(),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "UNKNOWN_COMPONENT",
      }),
    );
  });
});
