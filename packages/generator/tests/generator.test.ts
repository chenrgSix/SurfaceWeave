import { createStandardComponentRegistry } from "@surfaceweave/core";
import type { DynamicUIError } from "@surfaceweave/core";
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
        intent === "browse" ? "DataTable" : "Card",
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

    expect(surface.tree.component).toBe("Dialog");
    expect(surface.tree.props.summary).toEqual({ quantity: 2 });
  });

  it("rejects hard constraints that name an unknown component", () => {
    expect(() =>
      generateSurface(
        {
          surfaceId: "unsafe",
          schema: formSchema,
          intent: "form",
          data: {},
          developer: {
            hardConstraints: { rootComponent: "GeneratedReactCode" },
          },
        },
        createStandardComponentRegistry(),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "UNKNOWN_COMPONENT",
      }),
    );
  });

  it("falls back from unsupported soft hints and enforces hard visibility", () => {
    const surface = generateSurface(
      {
        surfaceId: "developer-priority",
        schema: formSchema,
        intent: "form",
        data: { buyer: "Ada", remark: "Visible only when allowed" },
        developer: {
          softHints: {
            rootComponent: "UnregisteredSoftRenderer",
            fields: {
              buyer: { hidden: true, component: "UnregisteredSoftInput" },
              remark: { hidden: false },
            },
          },
          hardConstraints: {
            allowedComponents: ["Form", "TextInput", "NumberInput"],
            fields: {
              buyer: { visible: true, component: "TextInput" },
              remark: { visible: false },
            },
          },
        },
      },
      createStandardComponentRegistry(),
    );

    expect(surface.tree.component).toBe("Form");
    expect(surface.tree.children?.map((node) => node.stableId)).toEqual([
      "buyer",
      "quantity",
    ]);
    expect(surface.tree.children?.[0]?.component).toBe("TextInput");
  });
});
