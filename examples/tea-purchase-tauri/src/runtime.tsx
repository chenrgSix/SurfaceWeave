import {
  AgentUIToolRuntime,
  PreferenceAgentToolRuntime,
  ToolToUIRuntime,
} from "@package-first/agent-tools";
import { createAntDesignComponentPack } from "@package-first/component-pack-antd";
import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  readDataPath,
} from "@package-first/core";
import type { PreferenceDocument } from "@package-first/core";
import { generateSurface } from "@package-first/generator";
import {
  PreferenceRepository,
  PreferenceService,
} from "@package-first/preferences";
import { createStandardReactComponentRegistry } from "@package-first/renderer-react";
import { MemoryStorageAdapter } from "@package-first/storage";
import { createTauriDynamicUIAdapter } from "@package-first/tauri";

import {
  MockTeaHostExecutor,
  createPurchaseOrder,
  searchTeaProducts,
  teaProducts,
  teaToolDefinitions,
} from "../../tea-purchase/src/tool-runtime-model.js";

export interface TauriExampleRuntime {
  componentRegistry: ReturnType<typeof createStandardComponentRegistry>;
  surfaceStore: InMemorySurfaceStore;
  reactComponents: ReturnType<typeof createStandardReactComponentRegistry>;
  toolRuntime: ToolToUIRuntime;
  searchSurfaceId: string;
  initialPreferenceError?: string;
  createSelectionSurface(): string;
  selectedTeaIds(): string[];
  createPurchaseSurface(): string;
  applyAgentLayoutOperations(): ReturnType<
    AgentUIToolRuntime["applyOperations"]
  >;
  saveRemarkPreference(): ReturnType<
    PreferenceAgentToolRuntime["savePreference"]
  >;
}

function currentPlatform(): "windows" | "macos" | "linux" | "unknown" {
  const platform = navigator.userAgent.toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "unknown";
}

export async function createExampleRuntime(): Promise<TauriExampleRuntime> {
  const componentRegistry = createStandardComponentRegistry();
  const surfaceStore = new InMemorySurfaceStore(componentRegistry);
  const reactComponents =
    createStandardReactComponentRegistry(componentRegistry);
  reactComponents.registerPack(
    createAntDesignComponentPack({
      theme: { token: { colorPrimary: "#315b3b" } },
    }),
  );
  const tauri = createTauriDynamicUIAdapter({
    namespace: "tea-purchase",
    userId: "local-demo-user",
    capabilities: {
      platform: currentPlatform(),
      desktop: true,
      filePicker: false,
      notifications: false,
      localStorage: true,
      nativeCommands: true,
    },
  });
  let preferenceService = new PreferenceService(
    new PreferenceRepository(tauri.preferenceStorage),
    componentRegistry,
  );
  let initialPreferenceError: string | undefined;
  try {
    await preferenceService.hydrate();
  } catch (error) {
    initialPreferenceError =
      error instanceof Error ? error.message : "偏好存储读取失败";
    preferenceService = new PreferenceService(
      new PreferenceRepository(new MemoryStorageAdapter<PreferenceDocument>()),
      componentRegistry,
    );
    await preferenceService.hydrate();
  }
  const toolRuntime = new ToolToUIRuntime(componentRegistry, surfaceStore);
  for (const definition of teaToolDefinitions)
    toolRuntime.registerTool(definition);
  const agentTools = new AgentUIToolRuntime(
    componentRegistry,
    surfaceStore,
    preferenceService,
    toolRuntime,
  );
  const preferenceTools = new PreferenceAgentToolRuntime(preferenceService);
  const host = new MockTeaHostExecutor();
  toolRuntime.onInvocationRequested((request) => {
    toolRuntime.markInvocationStarted(request.invocationId);
    void host
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
  const search = toolRuntime.createToolSurface({
    toolId: searchTeaProducts.id,
    surfaceId: "tea-search-form",
    initialValues: { kind: null, origin: null, maxPrice: null },
  });

  function createSelectionSurface(): string {
    const existing = surfaceStore.getSurface("tea-selection");
    if (existing) return existing.id;
    const raw = toolRuntime.getRawResult(search.invocation.id);
    const products = Array.isArray(raw)
      ? raw
      : teaProducts.map(({ id, name, kind, origin, price }) => ({
          id,
          name,
          kind,
          origin,
          price,
        }));
    return surfaceStore.createSurface(
      generateSurface(
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
          },
          context: { source: "local.selection" },
        },
        componentRegistry,
      ),
    ).id;
  }

  function selectedTeaIds(): string[] {
    const value = readDataPath(
      surfaceStore.requireSurface("tea-selection").data,
      "selectedTeaIds",
    );
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  function createPurchaseSurface(): string {
    const existing = surfaceStore.getSurface("purchase-form");
    if (existing) return existing.id;
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

  function applyAgentLayoutOperations() {
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

  function saveRemarkPreference() {
    return preferenceTools.savePreference({
      confirmed: true,
      preference: {
        id: "purchase-remark-collapsed",
        scope: "tool",
        toolId: createPurchaseOrder.id,
        targetStableId: "remark",
        schemaRef: {
          id: createPurchaseOrder.id,
          version: createPurchaseOrder.version,
        },
        operation: {
          type: "setProps",
          target: "remark",
          props: { collapsed: true },
        },
      },
    });
  }

  return {
    componentRegistry,
    surfaceStore,
    reactComponents,
    toolRuntime,
    searchSurfaceId: search.surface.id,
    ...(initialPreferenceError === undefined ? {} : { initialPreferenceError }),
    createSelectionSurface,
    selectedTeaIds,
    createPurchaseSurface,
    applyAgentLayoutOperations,
    saveRemarkPreference,
  };
}
