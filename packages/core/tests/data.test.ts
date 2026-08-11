import { describe, expect, it } from "vitest";

import {
  assertSafeDeclaration,
  readDataPath,
  writeDataPathImmutable,
} from "../src/index.js";
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

describe("writeDataPathImmutable", () => {
  it("copies only changed ancestors and clones the assigned value", () => {
    const original = {
      profile: { name: "Ada", address: { city: "Hangzhou" } },
      settings: { theme: "light" },
    };
    const assigned = { city: "Shanghai" };

    const next = writeDataPathImmutable(original, "profile.address", assigned);
    assigned.city = "mutated";

    expect(next).not.toBe(original);
    expect(next.profile).not.toBe(original.profile);
    expect((next.profile as { address: unknown }).address).not.toBe(
      (original.profile as { address: unknown }).address,
    );
    expect(next.settings).toBe(original.settings);
    expect(readDataPath(next, "profile.address.city")).toBe("Shanghai");
    expect(readDataPath(original, "profile.address.city")).toBe("Hangzhou");
  });
});
