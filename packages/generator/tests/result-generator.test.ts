import { createStandardComponentRegistry } from "@surfaceweave/core";
import { describe, expect, it } from "vitest";

import { generateResultSurface } from "../src/index.js";

const definition = {
  id: "tea.search",
  version: "1.0.0",
  inputSchema: { type: "object" },
  outputSchema: { type: "array" },
} as const;

describe("generateResultSurface", () => {
  it("projects lists deterministically without renderer-specific names", () => {
    const input = {
      definition,
      surfaceId: "tea-results",
      invocationId: "inv-1",
      correlationId: "corr-1",
      status: "success" as const,
      result: [{ id: "longjing", name: "Longjing" }],
    };
    const first = generateResultSurface(
      input,
      createStandardComponentRegistry(),
    );
    const second = generateResultSurface(
      input,
      createStandardComponentRegistry(),
    );

    expect(first).toEqual(second);
    expect(first.tree.children?.[0]?.component).toBe("DataTable");
    expect(JSON.stringify(first)).not.toMatch(/Ant|ReactAria|JSX/);
  });

  it("assigns distinct deterministic identities to nested result groups and values", () => {
    const input = {
      definition: {
        ...definition,
        outputSchema: { type: "object" },
      },
      surfaceId: "tea-result",
      invocationId: "inv-nested",
      correlationId: "corr-nested",
      status: "success" as const,
      result: { teas: ["Longjing"] },
    };

    const first = generateResultSurface(
      input,
      createStandardComponentRegistry(),
    );
    const second = generateResultSurface(
      input,
      createStandardComponentRegistry(),
    );
    const group = first.tree.children?.[0];
    const value = group?.children?.[0];

    expect(first).toEqual(second);
    expect(group).toMatchObject({
      component: "Accordion",
      stableId: "ui.group:result.teas",
    });
    expect(value).toMatchObject({
      component: "DataTable",
      stableId: "result.teas",
      binding: {
        path: "projection.result.teas",
        valueType: "array",
      },
    });
    expect(group?.id).not.toBe(value?.id);
  });

  it.each([
    ["success", undefined, "EmptyState"],
    ["partial", { id: "one" }, "Text"],
    ["error", undefined, "ErrorState"],
  ] as const)("renders %s result states", (status, result, component) => {
    const surface = generateResultSurface(
      {
        definition,
        surfaceId: `result-${status}`,
        invocationId: "inv-1",
        correlationId: "corr-1",
        status,
        ...(result === undefined ? {} : { result }),
        ...(status === "success"
          ? {}
          : { errors: [{ code: "PARTIAL", message: "Some items failed" }] }),
        ...(status === "error" ? { retryable: true } : {}),
      },
      createStandardComponentRegistry(),
    );

    expect(surface.tree.children?.[0]?.component).toBe(component);
    if (status === "error") {
      expect(surface.tree.children?.at(-1)?.props.action).toBe("tool.retry");
    }
  });
});
