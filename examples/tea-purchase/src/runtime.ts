import { AgentUIToolRuntime, ToolToUIRuntime } from "@surfaceweave/agent-tools";
import { createAntDesignComponentPack } from "@surfaceweave/antd";
import { createReactAriaComponentPack } from "@surfaceweave/react-aria";
import {
  InMemorySurfaceStore,
  createSurfaceClientCapabilities,
  createStandardComponentRegistry,
  readDataPath,
  recommendedSurfaceResourcePolicy,
} from "@surfaceweave/core";
import { generateSurface } from "@surfaceweave/generator";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";

import {
  teaBusinessReactPack,
  teaProductCardDefinition,
} from "./tea-component-pack.js";
import {
  MockTeaHostExecutor,
  createPurchaseOrder,
  searchTeaProducts,
  teaProducts,
  teaToolDefinitions,
} from "./tool-runtime-model.js";

export const componentRegistry = createStandardComponentRegistry();
componentRegistry.register(teaProductCardDefinition);
export const surfaceStore = new InMemorySurfaceStore(componentRegistry, {
  resourcePolicy: recommendedSurfaceResourcePolicy,
});
export const reactComponents =
  createStandardReactComponentRegistry(componentRegistry);
reactComponents.registerPack(createReactAriaComponentPack({ locale: "zh-CN" }));
reactComponents.registerPack(
  createAntDesignComponentPack({
    theme: { token: { colorPrimary: "#294b32" } },
  }),
);
reactComponents.registerPack(teaBusinessReactPack);

const clientCapabilityOptions = {
  rendererKind: "react",
  enabledPackIds: ["default", "react-aria", "antd", "tea-business"],
  terminalCapabilities: ["web"],
  supportedPackVersions: {
    default: ["1.0.0"],
    "react-aria": ["1.0.0"],
    antd: ["1.0.0"],
    "tea-business": ["1.0.0"],
  },
  runtimeCapabilities: [
    "operations",
    "preferences",
    "tool-invocation",
    "action-state",
  ],
  resourcePolicy: surfaceStore.getResourcePolicySummary(),
} as const;

export const clientCapabilities = createSurfaceClientCapabilities(
  componentRegistry,
  clientCapabilityOptions,
);

export const toolRuntime = new ToolToUIRuntime(componentRegistry, surfaceStore);
for (const definition of teaToolDefinitions)
  toolRuntime.registerTool(definition);
export const agentTools = new AgentUIToolRuntime(
  componentRegistry,
  surfaceStore,
  undefined,
  toolRuntime,
  { clientCapabilities: clientCapabilityOptions },
);

const hostExecutor = new MockTeaHostExecutor();
toolRuntime.onInvocationRequested((request) => {
  toolRuntime.markInvocationStarted(request.invocationId);
  void hostExecutor
    .execute(request)
    .then((result) =>
      toolRuntime.resolveInvocation(request.invocationId, result),
    )
    .catch((error: unknown) =>
      toolRuntime.rejectInvocation(request.invocationId, {
        code: "MOCK_HOST_ERROR",
        message: error instanceof Error ? error.message : "Mock host failed",
      }),
    );
});

export const searchFlow = toolRuntime.createToolSurface({
  toolId: searchTeaProducts.id,
  surfaceId: "tea-search-form",
  initialValues: {},
});

export function createSelectionSurface(): string {
  const existing = surfaceStore.getSurface("tea-selection");
  if (existing !== undefined) return existing.id;
  const result = toolRuntime.getRawResult(searchFlow.invocation.id);
  const products = Array.isArray(result)
    ? result
    : teaProducts.map(({ id, name, kind, origin, price }) => ({
        id,
        name,
        kind,
        origin,
        price,
      }));
  const generated = generateSurface(
    {
      surfaceId: "tea-selection",
      schema: {
        type: "object",
        properties: { teas: { type: "array", items: { type: "object" } } },
      },
      data: { teas: products, selectedTeaIds: [] },
      intent: "multi-select",
      metadata: {
        title: "选择茶叶",
        itemsPath: "teas",
        selectionPath: "selectedTeaIds",
        rootComponent: "TeaProductCard",
      },
      context: { source: "local.selection" },
    },
    componentRegistry,
  );
  return surfaceStore.createSurface(generated).id;
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

export function createPurchaseSurface(): string {
  const existing = surfaceStore.getSurface("purchase-form");
  if (existing !== undefined) return existing.id;
  return toolRuntime.createToolSurface({
    toolId: createPurchaseOrder.id,
    surfaceId: "purchase-form",
    initialValues: {
      items: selectedTeaIds(),
      supplier: "",
      delivery: { recipient: "", address: "", date: "" },
      remark: null,
    },
  }).surface.id;
}

export function applyAgentLayoutOperations() {
  const surface = surfaceStore.requireSurface("purchase-form");
  return agentTools.applyOperations({
    surfaceId: surface.id,
    baseRevision: surface.revision,
    reason: "收货信息前置并折叠备注",
    operations: [
      { type: "moveNode", target: "delivery", position: "first" },
      { type: "setProps", target: "remark", props: { collapsed: true } },
    ],
  });
}
