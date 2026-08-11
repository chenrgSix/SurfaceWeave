import { createStandardComponentRegistry } from "@surfaceweave/core";
import { generateToolSurface } from "@surfaceweave/generator";
import { describe, expect, it } from "vitest";

import {
  createPurchaseOrderFromOpenApi,
  searchTeaProductsFromOpenApi,
} from "./openapi-tools.js";

describe("tea purchase OpenAPI acceptance fixture", () => {
  it("generates the search form deterministically through the public APIs", () => {
    const input = {
      definition: searchTeaProductsFromOpenApi,
      surfaceId: "openapi-search-form",
    };
    const first = generateToolSurface(input, createStandardComponentRegistry());
    const second = generateToolSurface(
      input,
      createStandardComponentRegistry(),
    );

    expect(first).toEqual(second);
    expect(first.schemaRef).toEqual({
      id: "searchTeaProducts",
      version: "1.0.0",
    });
    expect(first.tree.children?.map((node) => node.stableId)).toEqual([
      "kind",
      "maxPrice",
      "origin",
      "pageSize",
    ]);
    expect(first.data).toEqual({ pageSize: 20 });
  });

  it("merges path parameters while excluding Host-owned request context", () => {
    expect(createPurchaseOrderFromOpenApi.inputSchema).toMatchObject({
      required: ["supplierId", "items", "delivery"],
      properties: {
        supplierId: { type: "string" },
        dryRun: { type: "boolean", default: false },
        delivery: { type: "object" },
        items: { type: "array" },
        priority: { type: "string", default: "normal" },
        remark: { type: ["string", "null"] },
      },
    });
    expect(JSON.stringify(createPurchaseOrderFromOpenApi)).not.toContain(
      "X-Tenant-Id",
    );
    expect(JSON.stringify(createPurchaseOrderFromOpenApi)).not.toContain(
      "bearerAuth",
    );
    expect(JSON.stringify(createPurchaseOrderFromOpenApi)).not.toContain(
      "api.example.invalid",
    );
  });
});
