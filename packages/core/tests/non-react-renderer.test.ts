import {
  ComponentPackResolver,
  InMemorySurfaceStore,
  createActionIntent,
  createStandardComponentRegistry,
  readDataPath,
  standardComponentManifests,
} from "../src/index.js";
import type {
  ActionIntent,
  ComponentManifest,
  ComponentPackManifest,
  JsonValue,
  SurfaceStore,
  UINode,
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
});
