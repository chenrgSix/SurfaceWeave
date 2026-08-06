import {
  AgentUIToolRuntime,
  PreferenceAgentToolRuntime,
} from "@package-first/agent-tools";
import { createAntDesignComponentPack } from "@package-first/component-pack-antd";
import {
  InMemorySurfaceStore,
  cloneValue,
  createStandardComponentRegistry,
  readDataPath,
} from "@package-first/core";
import type {
  ComponentRegistry,
  JsonValue,
  PreferenceDocument,
  Surface,
} from "@package-first/core";
import { generateSurface } from "@package-first/generator";
import {
  PreferenceRepository,
  PreferenceService,
} from "@package-first/preferences";
import {
  createStandardReactComponentRegistry,
  type RendererComponentProps,
} from "@package-first/renderer-react";
import { MemoryStorageAdapter } from "@package-first/storage";
import { createTauriDynamicUIAdapter } from "@package-first/tauri";

export interface Tea {
  id: string;
  name: string;
  origin: string;
  price: number;
}

function NativeActions({ value, onAction }: RendererComponentProps) {
  const selectedTeaIds = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  return (
    <div className="native-actions">
      <button
        type="button"
        onClick={() => onAction("tea.search", { query: "" })}
      >
        Rust Command 查询茶叶
      </button>
      <button
        type="button"
        onClick={() => onAction("purchase.create", { selectedTeaIds })}
      >
        创建采购草稿
      </button>
      <button
        type="button"
        onClick={() => onAction("desktop.unregistered", null)}
      >
        验证未注册动作
      </button>
    </div>
  );
}

function currentPlatform(): "windows" | "macos" | "linux" | "unknown" {
  const platform = navigator.userAgent.toLowerCase();
  if (platform.includes("mac")) return "macos";
  if (platform.includes("win")) return "windows";
  if (platform.includes("linux")) return "linux";
  return "unknown";
}

export interface TauriExampleRuntime {
  componentRegistry: ReturnType<typeof createStandardComponentRegistry>;
  surfaceStore: InMemorySurfaceStore;
  reactComponents: ReturnType<typeof createStandardReactComponentRegistry>;
  actionExecutor: ReturnType<
    typeof createTauriDynamicUIAdapter
  >["actionExecutor"];
  preferenceTools: PreferenceAgentToolRuntime;
  initialPreferenceError?: string;
  replaceTeaResults(teas: Tea[]): Surface;
  selectedTeaIds(): string[];
  ensurePurchaseSurface(): ReturnType<AgentUIToolRuntime["createSurface"]>;
  applyAgentLayoutOperations(): ReturnType<
    AgentUIToolRuntime["applyOperations"]
  >;
  saveRemarkPreference(): ReturnType<
    PreferenceAgentToolRuntime["savePreference"]
  >;
}

function teaSurface(
  teas: Tea[],
  componentRegistry: ComponentRegistry,
): Omit<Surface, "revision"> {
  const generated = generateSurface(
    {
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
      data: {
        teas: teas.map((tea) => ({
          id: tea.id,
          name: tea.name,
          origin: tea.origin,
          price: tea.price,
        })),
        selectedTeaIds: [],
      },
      intent: "multi-select",
      developer: {
        softHints: {
          title: "选择茶叶",
          itemsPath: "teas",
          selectionPath: "selectedTeaIds",
        },
      },
      context: { source: "tea.search" },
    },
    componentRegistry,
  );
  return {
    ...generated,
    tree: {
      id: "tea-selection:desktop-root",
      stableId: "tea-selection.root",
      component: "Stack",
      props: {},
      children: [
        {
          id: "tea-selection:native-actions",
          stableId: "tea-selection.native-actions",
          component: "NativeActions",
          props: {},
          binding: { path: "selectedTeaIds", valueType: "array" },
        },
        generated.tree,
      ],
    },
  };
}

export async function createExampleRuntime(): Promise<TauriExampleRuntime> {
  const componentRegistry = createStandardComponentRegistry();
  componentRegistry.register({
    type: "NativeActions",
    binding: { valueTypes: ["array"] },
    actions: ["tea.search", "purchase.create", "desktop.unregistered"],
    capabilities: ["desktop"],
  });
  const surfaceStore = new InMemorySurfaceStore(componentRegistry);
  const reactComponents =
    createStandardReactComponentRegistry(componentRegistry);
  reactComponents.registerPack(
    createAntDesignComponentPack({
      theme: { token: { colorPrimary: "#315b3b" } },
    }),
  );
  reactComponents.register("NativeActions", NativeActions);

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
  const agentTools = new AgentUIToolRuntime(
    componentRegistry,
    surfaceStore,
    preferenceService,
  );
  const preferenceTools = new PreferenceAgentToolRuntime(preferenceService);

  surfaceStore.createSurface(teaSurface([], componentRegistry));

  tauri.actionExecutor.register("tea.search", async (input, { invoke }) => {
    const query =
      typeof input === "object" &&
      input !== null &&
      !Array.isArray(input) &&
      typeof input.query === "string"
        ? input.query
        : "";
    return invoke<JsonValue>("search_teas", { query });
  });
  tauri.actionExecutor.register(
    "purchase.create",
    async (input, { intent, invoke }) => {
      const selectedTeaIds =
        typeof input === "object" &&
        input !== null &&
        !Array.isArray(input) &&
        Array.isArray(input.selectedTeaIds)
          ? input.selectedTeaIds.filter(
              (item): item is string => typeof item === "string",
            )
          : [];
      return invoke<JsonValue>("create_purchase", {
        payload: { selectedTeaIds, quantity: 1 },
        idempotencyKey: intent.idempotencyKey,
      });
    },
    {
      validate: (input) => {
        if (
          typeof input !== "object" ||
          input === null ||
          Array.isArray(input) ||
          !Array.isArray(input.selectedTeaIds) ||
          input.selectedTeaIds.length === 0
        ) {
          throw new Error("At least one tea is required");
        }
      },
      authorize: () => true,
    },
  );

  function selectedTeaIds(): string[] {
    const selected = readDataPath(
      surfaceStore.requireSurface("tea-selection").data,
      "selectedTeaIds",
    );
    return Array.isArray(selected)
      ? selected.filter((item): item is string => typeof item === "string")
      : [];
  }

  function ensurePurchaseSurface() {
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
          selectedTeaIds: { type: "array", items: { type: "string" } },
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
      schemaRef: { id: "purchase", version: "1" },
      toolId: "purchase.create",
      developer: {
        softHints: {
          title: "茶叶采购单",
          fields: {
            selectedTeaIds: { hidden: true },
            quantity: { order: 0 },
            remark: { order: 1 },
            shipping: { order: 2 },
          },
        },
      },
      context: { source: "purchase.create" },
    });
  }

  function replaceTeaResults(teas: Tea[]): Surface {
    const current = surfaceStore.requireSurface("tea-selection");
    const replacement = teaSurface(teas, componentRegistry);
    return surfaceStore.replaceSurface("tea-selection", current.revision, {
      ...cloneValue(replacement),
    });
  }

  function applyAgentLayoutOperations() {
    const surface = surfaceStore.requireSurface("purchase-form");
    return agentTools.applyOperations({
      surfaceId: surface.id,
      baseRevision: surface.revision,
      reason: "用户希望收货信息最显眼，并折叠可选备注",
      operations: [
        { type: "moveNode", target: "shipping", position: "first" },
        {
          type: "setProps",
          target: "remark",
          props: { collapsed: true },
        },
      ],
    });
  }

  function saveRemarkPreference() {
    return preferenceTools.savePreference({
      confirmed: true,
      preference: {
        id: "purchase-remark-collapsed",
        scope: "tool",
        toolId: "purchase.create",
        targetStableId: "remark",
        schemaRef: { id: "purchase", version: "1" },
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
    actionExecutor: tauri.actionExecutor,
    preferenceTools,
    ...(initialPreferenceError === undefined ? {} : { initialPreferenceError }),
    replaceTeaResults,
    selectedTeaIds,
    ensurePurchaseSurface,
    applyAgentLayoutOperations,
    saveRemarkPreference,
  };
}
