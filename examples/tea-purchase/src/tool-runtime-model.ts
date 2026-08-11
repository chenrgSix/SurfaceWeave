import type {
  JsonValue,
  ToolDefinition,
  ToolHostExecutor,
  ToolSubmissionRequest,
} from "@surfaceweave/core";

import { searchTeaProductsFromOpenApi } from "./openapi-tools.js";

export interface TeaProduct {
  id: string;
  name: string;
  kind: string;
  origin: string;
  price: number;
}

export const teaProducts: TeaProduct[] = [
  {
    id: "longjing",
    name: "西湖龙井",
    kind: "green",
    origin: "浙江",
    price: 168,
  },
  {
    id: "tieguanyin",
    name: "安溪铁观音",
    kind: "oolong",
    origin: "福建",
    price: 128,
  },
  {
    id: "dahongpao",
    name: "武夷大红袍",
    kind: "oolong",
    origin: "福建",
    price: 198,
  },
];

export const searchTeaProducts: ToolDefinition = {
  ...searchTeaProductsFromOpenApi,
  annotations: { sideEffect: false, confirmation: "never", retry: "safe" },
  uiHints: { softHints: { title: "筛选茶叶商品" } },
};

export const createPurchaseOrder: ToolDefinition = {
  id: "createPurchaseOrder",
  version: "1.0.0",
  title: "创建茶叶采购单",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["items", "supplier", "delivery"],
    properties: {
      items: {
        type: "array",
        title: "采购商品",
        items: { type: "string" },
        readOnly: true,
      },
      supplier: { type: "string", title: "供应商", minLength: 1 },
      delivery: {
        type: "object",
        title: "收货信息",
        required: ["recipient", "address"],
        properties: {
          recipient: { type: "string", title: "收货人", minLength: 1 },
          address: { type: "string", title: "收货地址", minLength: 1 },
          date: { type: "string", title: "期望日期", format: "date" },
        },
      },
      remark: { type: ["string", "null"], title: "备注" },
    },
  },
  outputSchema: {
    type: "object",
    required: ["orderId", "status"],
    properties: { orderId: { type: "string" }, status: { type: "string" } },
  },
  annotations: {
    sideEffect: true,
    confirmation: "required",
    retry: "safe",
  },
  uiHints: {
    softHints: {
      title: "茶叶采购单",
      fields: {
        delivery: { order: 2 },
        items: { hidden: true },
        remark: { order: 1 },
        supplier: { order: 0 },
      },
    },
  },
};

export class MockTeaHostExecutor implements ToolHostExecutor {
  async execute(request: ToolSubmissionRequest): Promise<JsonValue> {
    if (request.toolId === searchTeaProducts.id) {
      const { kind, origin, maxPrice, pageSize } = request.validatedArguments;
      const matches = teaProducts
        .filter(
          (tea) =>
            (typeof kind !== "string" || tea.kind === kind) &&
            (typeof origin !== "string" || tea.origin.includes(origin)) &&
            (typeof maxPrice !== "number" || tea.price <= maxPrice),
        )
        .map(({ id, name, kind: teaKind, origin: teaOrigin, price }) => ({
          id,
          name,
          kind: teaKind,
          origin: teaOrigin,
          price,
        }));
      return typeof pageSize === "number"
        ? matches.slice(0, pageSize)
        : matches;
    }
    if (request.toolId === createPurchaseOrder.id) {
      return { orderId: `PO-${request.invocationId}`, status: "created" };
    }
    throw new Error(`Host has no executor for ${request.toolId}`);
  }
}

export const teaToolDefinitions = [searchTeaProducts, createPurchaseOrder];
