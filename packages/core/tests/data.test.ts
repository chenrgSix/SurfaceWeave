import { describe, expect, it } from "vitest";

import { assertSafeDeclaration } from "../src/index.js";
import type { DynamicUIError } from "../src/index.js";

describe("assertSafeDeclaration", () => {
  it("preserves inert code-like strings and ordinary business keys", () => {
    expect(() =>
      assertSafeDeclaration({
        code: "A => B",
        command: "function(example)",
        documentation: "import(module) and <script> are displayed as text",
      }),
    ).not.toThrow();
  });

  it("rejects functions and non-plain objects", () => {
    expect(() =>
      assertSafeDeclaration({ callback: () => undefined }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "INVALID_SURFACE",
      }),
    );

    expect(() => assertSafeDeclaration(new Date())).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "INVALID_SURFACE",
      }),
    );
  });

  it("rejects prototype-polluting and framework-specific fields", () => {
    const polluted = JSON.parse('{"__proto__":{"polluted":true}}') as unknown;
    expect(() => assertSafeDeclaration(polluted)).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "INVALID_SURFACE",
      }),
    );
    expect(() => assertSafeDeclaration({ className: "vendor" })).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "INVALID_COMPONENT_PACK",
      }),
    );
    expect(() =>
      assertSafeDeclaration({ dangerouslySetInnerHTML: { __html: "unsafe" } }),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "INVALID_COMPONENT_PACK",
      }),
    );
  });
});
