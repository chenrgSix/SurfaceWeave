import type { ToolSubmissionRequest } from "@package-first/core";
import { describe, expect, it } from "vitest";

import { MockTeaHostExecutor } from "./tool-runtime-model.js";

function request(
  toolId: string,
  validatedArguments: ToolSubmissionRequest["validatedArguments"],
): ToolSubmissionRequest {
  return {
    invocationId: `inv-${toolId}`,
    toolId,
    toolVersion: "1.0.0",
    validatedArguments,
    correlationId: "tea-flow",
    idempotencyKey: `inv-${toolId}:1`,
    sourceSurfaceId: `${toolId}-form`,
    sequence: 1,
  };
}

describe("tea purchase mock Host executor", () => {
  it("runs the search and purchase steps through the same typed Host boundary", async () => {
    const host = new MockTeaHostExecutor();
    const products = await host.execute(
      request("searchTeaProducts", { kind: "oolong", maxPrice: 150 }),
    );
    expect(products).toEqual([
      expect.objectContaining({ id: "tieguanyin", price: 128 }),
    ]);

    const order = await host.execute(
      request("createPurchaseOrder", {
        items: ["tieguanyin"],
        supplier: "福建茶业",
        delivery: { recipient: "Ada", address: "杭州" },
      }),
    );
    expect(order).toEqual({
      orderId: "PO-inv-createPurchaseOrder",
      status: "created",
    });
  });
});
