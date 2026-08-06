import { describe, expect, it } from "vitest";

import {
  assertMatchesJsonSchema,
  assertValidJsonSchema,
  createStandardComponentRegistry,
} from "../src/index.js";

describe("CSP-safe JSON Schema validation", () => {
  it("does not require eval or Function compilation", () => {
    const OriginalFunction = globalThis.Function;
    globalThis.Function = function blockedFunction(): never {
      throw new Error("dynamic code generation blocked by CSP");
    } as unknown as FunctionConstructor;
    try {
      expect(() => createStandardComponentRegistry()).not.toThrow();
      expect(() =>
        assertMatchesJsonSchema(
          {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: { name: { type: "string", minLength: 1 } },
          },
          { name: "tea" },
        ),
      ).not.toThrow();
    } finally {
      globalThis.Function = OriginalFunction;
    }
  });

  it("rejects structurally invalid schema keywords", () => {
    expect(() => assertValidJsonSchema({ type: "not-a-json-type" })).toThrow(
      /not a valid JSON Schema 2020-12/,
    );
    expect(() => assertValidJsonSchema({ required: "name" })).toThrow(
      /not a valid JSON Schema 2020-12/,
    );
  });
});
