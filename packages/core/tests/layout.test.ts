import {
  DynamicUIError,
  parseSemanticLayout,
  resolveSemanticLayout,
  serializeSemanticLayout,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("Semantic LayoutSpec 1.0", () => {
  it("parses and serializes the portable layout vocabulary", () => {
    const layout = {
      direction: "column" as const,
      columns: 3,
      gap: 16,
      align: "stretch" as const,
      justify: "between" as const,
      modes: {
        compact: { columns: 1 },
        workspace: { columns: 3, span: 2 },
      },
    };

    expect(parseSemanticLayout(layout)).toEqual(layout);
    expect(serializeSemanticLayout(layout)).toEqual(layout);
  });

  it("strictly rejects unknown properties and invalid values", () => {
    expect(() => parseSemanticLayout({ className: "grid" })).toThrow(
      DynamicUIError,
    );
    expect(() => parseSemanticLayout({ columns: 0, gap: 65 })).toThrow(
      /columns must be an integer from 1 to 12/,
    );
    expect(() =>
      parseSemanticLayout({ modes: { mobile: { columns: 1 } } }),
    ).toThrow(/Layout mode "mobile" is not supported/);
  });

  it("resolves view overrides, filters capabilities, and degrades compact grids", () => {
    const compact = resolveSemanticLayout(
      {
        direction: "row",
        columns: 4,
        gap: 12,
        align: "stretch",
        unknown: "ignored",
        modes: { compact: { gap: 8 } },
      },
      "compact",
      ["columns", "gap"],
    );

    expect(compact.layout).toEqual({ columns: 1, gap: 8 });
    expect(compact.diagnostics.map((item) => item.code)).toEqual([
      "UNKNOWN_LAYOUT_PROPERTY",
      "UNSUPPORTED_LAYOUT_FEATURE",
      "UNSUPPORTED_LAYOUT_FEATURE",
      "COMPACT_LAYOUT_FALLBACK",
    ]);

    expect(
      resolveSemanticLayout(
        { columns: 2, modes: { workspace: { columns: 4 } } },
        "workspace",
      ).layout,
    ).toEqual({ columns: 4 });
  });
});
