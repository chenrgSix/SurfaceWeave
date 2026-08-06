import { AgentUIToolRuntime } from "@package-first/agent-tools";
import { createAntDesignComponentPack } from "@package-first/component-pack-antd";
import { createReactAriaComponentPack } from "@package-first/component-pack-react-aria";
import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  readDataPath,
} from "@package-first/core";
import { createStandardReactComponentRegistry } from "@package-first/renderer-react";

import {
  teaBusinessReactPack,
  teaProductCardDefinition,
} from "./tea-component-pack.js";

export const componentRegistry = createStandardComponentRegistry();
componentRegistry.register(teaProductCardDefinition);
export const surfaceStore = new InMemorySurfaceStore(componentRegistry);
export const reactComponents =
  createStandardReactComponentRegistry(componentRegistry);
reactComponents.registerPack(createReactAriaComponentPack({ locale: "zh-CN" }));
reactComponents.registerPack(
  createAntDesignComponentPack({
    theme: { token: { colorPrimary: "#294b32" } },
  }),
);
reactComponents.registerPack(teaBusinessReactPack);
export const agentTools = new AgentUIToolRuntime(
  componentRegistry,
  surfaceStore,
);

export const teaToolResult = {
  teas: [
    {
      id: "longjing",
      name: "西湖龙井",
      origin: "浙江杭州",
      price: 168,
    },
    {
      id: "tieguanyin",
      name: "安溪铁观音",
      origin: "福建安溪",
      price: 128,
    },
    {
      id: "dahongpao",
      name: "武夷大红袍",
      origin: "福建武夷山",
      price: 198,
    },
  ],
};

const teaSurface = agentTools.createSurface({
  surfaceId: "tea-selection",
  schema: {
    type: "object",
    title: "可选茶叶",
    properties: {
      teas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            origin: { type: "string" },
            price: { type: "number" },
          },
        },
      },
    },
  },
  data: { ...teaToolResult, selectedTeaIds: [] },
  intent: "multi-select",
  metadata: {
    title: "选择茶叶",
    itemsPath: "teas",
    selectionPath: "selectedTeaIds",
    rootComponent: "TeaProductCard",
  },
  context: { source: "tea.search" },
});

if (!teaSurface.ok) {
  throw new Error(teaSurface.error.message);
}

export function selectedTeaIds(): string[] {
  const selected = readDataPath(
    surfaceStore.requireSurface("tea-selection").data,
    "selectedTeaIds",
  );
  return Array.isArray(selected)
    ? selected.filter((item): item is string => typeof item === "string")
    : [];
}

export function ensurePurchaseSurface() {
  const existing = surfaceStore.getSurface("purchase-form");
  if (existing !== undefined) {
    return { ok: true as const, value: existing };
  }
  return agentTools.createSurface({
    surfaceId: "purchase-form",
    schema: {
      type: "object",
      title: "创建采购单",
      required: ["quantity", "shipping"],
      properties: {
        selectedTeaIds: {
          type: "array",
          items: { type: "string" },
        },
        quantity: { type: "integer", title: "采购数量", default: 1 },
        remark: { type: "string", title: "备注" },
        shipping: {
          type: "object",
          title: "收货信息",
          required: ["recipient", "address"],
          properties: {
            recipient: { type: "string", title: "收货人" },
            address: { type: "string", title: "收货地址" },
            phone: { type: "string", title: "联系电话" },
          },
        },
      },
    },
    data: {
      selectedTeaIds: selectedTeaIds(),
      quantity: 1,
      remark: "",
      shipping: { recipient: "", address: "", phone: "" },
    },
    intent: "form",
    metadata: {
      title: "茶叶采购单",
      fields: {
        selectedTeaIds: { hidden: true },
        quantity: { order: 0 },
        remark: { order: 1 },
        shipping: { order: 2 },
      },
    },
    context: { source: "purchase.create" },
  });
}

export function applyAgentLayoutOperations() {
  const surface = surfaceStore.requireSurface("purchase-form");
  return agentTools.applyOperations({
    surfaceId: surface.id,
    baseRevision: surface.revision,
    reason: "用户希望收货信息最显眼，并折叠可选备注",
    operations: [
      {
        type: "moveNode",
        target: "shipping",
        position: "first",
      },
      {
        type: "setProps",
        target: "remark",
        props: { collapsed: true },
      },
    ],
  });
}
