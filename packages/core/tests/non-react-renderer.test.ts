import {
  ComponentPackResolver,
  InMemorySurfaceStore,
  createActionIntent,
  createStandardComponentRegistry,
  readDataPath,
  resolveSemanticLayout,
  standardComponentManifests,
  walkNodes,
} from "../src/index.js";
import type {
  ActionIntent,
  ComponentManifest,
  ComponentPackManifest,
  JsonValue,
  SurfaceStore,
  UINode,
  SemanticLayoutFeature,
  SurfaceViewMode,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

type FakeBinding = (node: UINode, value: JsonValue | undefined) => string;

function semantic(type: string): ComponentManifest {
  const result = standardComponentManifests.find(
    (item) => item.semanticType === type,
  );
  if (result === undefined) throw new Error(`Missing ${type}`);
  return result;
}

class FakeRenderer {
  readonly #resolver: ComponentPackResolver;
  readonly #bindings: Record<string, Record<string, FakeBinding>>;
  readonly #store: SurfaceStore;
  readonly #registry: ReturnType<typeof createStandardComponentRegistry>;

  constructor(
    registry: ReturnType<typeof createStandardComponentRegistry>,
    store: SurfaceStore,
    packs: Array<{
      manifest: ComponentPackManifest;
      bindings: Record<string, FakeBinding>;
    }>,
  ) {
    this.#registry = registry;
    this.#store = store;
    this.#resolver = new ComponentPackResolver(registry);
    this.#bindings = Object.fromEntries(
      packs.map((pack) => {
        registry.registerPack(pack.manifest);
        return [pack.manifest.id, pack.bindings];
      }),
    );
  }

  render(surfaceId: string, preferredPack: string): string[] {
    const surface = this.#store.requireSurface(surfaceId);
    const output: string[] = [];
    const visit = (node: UINode): void => {
      const resolution = this.#resolver.resolve({
        semanticType: node.component,
        rendererKind: "fake",
        preferredPack,
        availablePackIds: Object.keys(this.#bindings),
      });
      const binding =
        this.#bindings[resolution.packId]?.[resolution.resolvedSemanticType];
      if (binding === undefined) throw new Error("Missing fake binding");
      output.push(
        binding(
          node,
          node.binding === undefined
            ? undefined
            : readDataPath(surface.data, node.binding.path),
        ),
      );
      node.children?.forEach(visit);
    };
    visit(surface.tree);
    return output;
  }

  action(surfaceId: string, nodeId: string): ActionIntent {
    return createActionIntent(
      this.#registry,
      this.#store.requireSurface(surfaceId),
      {
        id: "fake-action-1",
        nodeId,
        action: "select",
        input: { value: ["longjing"] },
      },
    );
  }

  layout(
    surfaceId: string,
    nodeId: string,
    mode: SurfaceViewMode,
    supported: SemanticLayoutFeature[],
  ) {
    let selected: UINode | undefined;
    walkNodes(this.#store.requireSurface(surfaceId).tree, (node) => {
      if (node.id === nodeId) selected = node;
    });
    if (selected === undefined) throw new Error("Missing layout node");
    return resolveSemanticLayout(selected.layout, mode, supported);
  }
}

describe("framework-agnostic renderer contract", () => {
  it("renders, falls back, updates data, and emits ActionIntent without React or DOM", () => {
    const registry = createStandardComponentRegistry();
    registry.register({
      type: "TeaProductCard",
      propsSchema: {
        type: "object",
        additionalProperties: false,
        required: ["label", "options", "multiple"],
        properties: {
          label: { type: "string" },
          options: { type: "array" },
          multiple: { type: "boolean" },
        },
      },
      binding: { valueTypes: ["array"], semantics: ["selection"] },
      actions: ["select"],
      fallback: "ChoiceField",
    });
    const store = new InMemorySurfaceStore(registry);
    store.createSurface({
      id: "tea",
      intent: "multi-select",
      tree: {
        id: "tea-card",
        stableId: "tea.longjing",
        component: "TeaProductCard",
        props: {
          label: "Longjing",
          options: [{ id: "longjing", name: "Longjing" }],
          multiple: true,
        },
        binding: {
          path: "selectedTeaIds",
          valueType: "array",
          semantic: "selection",
        },
      },
      data: { selectedTeaIds: [] },
      context: {},
    });
    const manifests = [semantic("TextInput"), semantic("ChoiceField")];
    const fake = new FakeRenderer(registry, store, [
      {
        manifest: {
          protocolVersion: "1.0",
          id: "plain",
          version: "1.0.0",
          rendererKind: "fake",
          components: manifests,
        },
        bindings: {
          TextInput: (_node, value) => `plain-input:${String(value ?? "")}`,
          ChoiceField: (node, value) =>
            `plain-choice:${node.props.label}:${JSON.stringify(value)}`,
        },
      },
      {
        manifest: {
          protocolVersion: "1.0",
          id: "terminal",
          version: "1.0.0",
          rendererKind: "fake",
          components: manifests,
        },
        bindings: {
          TextInput: (_node, value) => `terminal-input:${String(value ?? "")}`,
          ChoiceField: (node, value) =>
            `terminal-choice:${node.props.label}:${JSON.stringify(value)}`,
        },
      },
    ]);

    expect(fake.render("tea", "plain")).toEqual(["plain-choice:Longjing:[]"]);
    store.updateData("tea", 0, [
      { path: "selectedTeaIds", value: ["longjing"] },
    ]);
    expect(fake.render("tea", "terminal")).toEqual([
      'terminal-choice:Longjing:["longjing"]',
    ]);
    expect(fake.action("tea", "tea-card")).toEqual({
      id: "fake-action-1",
      surfaceId: "tea",
      nodeId: "tea-card",
      action: "select",
      input: { value: ["longjing"] },
    });
    expect(store.requireSurface("tea").tree.component).toBe("TeaProductCard");
  });

  it("resolves the same semantic layout without React, DOM, or CSS types", () => {
    const registry = createStandardComponentRegistry();
    const store = new InMemorySurfaceStore(registry);
    store.createSurface({
      id: "portable-layout",
      intent: "form",
      tree: {
        id: "grid",
        component: "Grid",
        props: {},
        layout: {
          columns: 3,
          gap: 12,
          align: "stretch",
          modes: { compact: { gap: 8 } },
        },
      },
      data: {},
      context: {},
    });
    const fake = new FakeRenderer(registry, store, [
      {
        manifest: {
          protocolVersion: "1.0",
          id: "layout-terminal",
          version: "1.0.0",
          rendererKind: "fake",
          components: [semantic("Grid")],
        },
        bindings: { Grid: () => "grid" },
      },
    ]);

    expect(
      fake.layout("portable-layout", "grid", "compact", ["columns", "gap"]),
    ).toMatchObject({
      layout: { columns: 1, gap: 8 },
      diagnostics: [
        expect.objectContaining({ code: "UNSUPPORTED_LAYOUT_FEATURE" }),
        expect.objectContaining({ code: "COMPACT_LAYOUT_FALLBACK" }),
      ],
    });
  });
});
