import type { ComponentManifest, ToolDefinition } from "@surfaceweave/core";

/** Fictional business fixtures. No route, price, or service commitment is live. */
export const routes = [
  {
    id: "air",
    name: "空运紧急补货",
    route: "深圳 SZX → 慕尼黑 MUC",
    hours: 18,
    cost: "¥ 86,000",
    coverage: "全部 8 条产线",
    tag: "最快恢复",
    saving: 36,
  },
  {
    id: "relay",
    name: "欧洲库存调拨",
    route: "华沙 WAW → 慕尼黑 MUC",
    hours: 28,
    cost: "¥ 32,000",
    coverage: "优先恢复 6 条产线",
    tag: "成本优先",
    saving: 26,
  },
  {
    id: "ocean",
    name: "等待原始船期",
    route: "深圳 SZX → 汉堡 HAM",
    hours: 54,
    cost: "¥ 0",
    coverage: "8 条产线延迟恢复",
    tag: "原始方案",
    saving: 0,
  },
] as const;

export const routeComparisonManifest: ComponentManifest = {
  semanticType: "RouteComparison",
  description:
    "Compare host-provided recovery routes while retaining a string selection binding.",
  propsSchema: {
    type: "object",
    properties: { label: { type: "string" }, options: { type: "array" } },
  },
  binding: { valueTypes: ["string"] },
  fallback: "ChoiceField",
};

export const recoveryTool: ToolDefinition = {
  id: "logistics.recovery.create",
  version: "1.0.0",
  title: "供应链恢复计划",
  description:
    "Create a recovery order through the host after human confirmation.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["route", "owner", "approval", "note"],
    properties: {
      route: {
        type: "string",
        title: "运输方案",
        enum: ["air", "relay", "ocean"],
      },
      owner: { type: "string", title: "执行负责人", minLength: 1 },
      note: { type: "string", title: "交接备注", minLength: 1, maxLength: 240 },
      approval: {
        type: "boolean",
        title: "我已核对额外费用与产线影响",
        const: true,
      },
    },
  },
  outputSchema: {
    type: "object",
    required: ["orderId", "route", "status"],
    properties: {
      orderId: { type: "string" },
      route: { type: "string" },
      status: { type: "string" },
    },
  },
  annotations: { sideEffect: true, confirmation: "required", retry: "safe" },
  uiHints: {
    hardConstraints: {
      fields: {
        approval: {
          visible: true,
          component: "Checkbox",
          locked: ["visibility", "component", "props"],
        },
      },
    },
    softHints: {
      title: "供应链恢复计划",
      layout: { gap: 16 },
      fields: {
        route: { order: 0 },
        owner: { order: 1 },
        note: { order: 2 },
        approval: { order: 3 },
      },
    },
  },
};
