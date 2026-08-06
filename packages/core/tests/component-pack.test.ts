import {
  ComponentPackResolver,
  DynamicUIError,
  InMemorySurfaceStore,
  createActionIntent,
  createStandardComponentRegistry,
  standardComponentManifests,
  validateComponentPack,
  validateSurface,
} from "../src/index.js";
import type { ComponentManifest, ComponentPackManifest } from "../src/index.js";
import { describe, expect, it } from "vitest";

function component(type: string): ComponentManifest {
  const manifest = standardComponentManifests.find(
    (item) => item.semanticType === type,
  );
  if (manifest === undefined) throw new Error(`Missing ${type}`);
  return manifest;
}

function pack(
  id: string,
  priority: number,
  components: ComponentManifest[] = [component("TextInput")],
): ComponentPackManifest {
  return {
    protocolVersion: "1.0",
    id,
    version: "1.0.0",
    rendererKind: "fake",
    priority,
    components,
  };
}

describe("Component Pack Protocol", () => {
  it("accepts a serializable manifest and resolves deterministically", () => {
    const registry = createStandardComponentRegistry();
    registry.registerPack(pack("zeta", 1));
    registry.registerPack(pack("alpha", 1));
    const resolver = new ComponentPackResolver(registry);

    expect(JSON.parse(JSON.stringify(registry.listPacks()))).toEqual(
      registry.listPacks(),
    );
    expect(
      resolver.resolve({ semanticType: "TextInput", rendererKind: "fake" }),
    ).toMatchObject({ packId: "alpha", resolvedSemanticType: "TextInput" });
    expect(
      resolver.resolve({
        semanticType: "TextInput",
        rendererKind: "fake",
        packPriorities: { zeta: 5 },
      }),
    ).toMatchObject({ packId: "zeta" });
  });

  it("reports an unavailable preferred pack instead of selecting it silently", () => {
    const registry = createStandardComponentRegistry();
    registry.registerPack(pack("available", 0));

    const resolution = new ComponentPackResolver(registry).resolve({
      semanticType: "TextInput",
      rendererKind: "fake",
      preferredPack: "missing",
    });

    expect(resolution.packId).toBe("available");
    expect(resolution.diagnostics).toContainEqual(
      expect.objectContaining({ code: "PREFERRED_PACK_UNAVAILABLE" }),
    );
  });

  it("filters packs and components by terminal capabilities", () => {
    const registry = createStandardComponentRegistry();
    registry.registerPack({
      ...pack("desktop-only", 10),
      capabilities: ["desktop"],
    });
    registry.registerPack(pack("portable", 0));
    const resolver = new ComponentPackResolver(registry);

    expect(
      resolver.resolve({ semanticType: "TextInput", rendererKind: "fake" }),
    ).toMatchObject({ packId: "portable" });
    expect(
      resolver.resolve({
        semanticType: "TextInput",
        rendererKind: "fake",
        capabilities: ["desktop"],
      }),
    ).toMatchObject({ packId: "desktop-only" });
  });

  it("uses semantic fallback without rewriting the Surface node", () => {
    const registry = createStandardComponentRegistry();
    registry.register({
      type: "TeaProductCard",
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" } },
      },
      binding: { valueTypes: ["array"] },
      actions: ["select"],
      fallback: "ChoiceField",
    });
    registry.registerPack(pack("fake-choice", 0, [component("ChoiceField")]));

    const resolution = new ComponentPackResolver(registry).resolve({
      semanticType: "TeaProductCard",
      rendererKind: "fake",
    });

    expect(resolution.resolvedSemanticType).toBe("ChoiceField");
    expect(resolution.fallbackChain).toEqual(["TeaProductCard", "ChoiceField"]);
    expect(resolution.diagnostics).toContainEqual(
      expect.objectContaining({ code: "FALLBACK_APPLIED" }),
    );
  });

  it("rejects fallback cycles, duplicate semantics, invalid versions, and code", () => {
    const cycle = pack("cycle", 0, [
      { semanticType: "One", propsSchema: {}, fallback: "Two" },
      { semanticType: "Two", propsSchema: {}, fallback: "One" },
    ]);
    expect(validateComponentPack(cycle)).toMatchObject({ valid: false });
    expect(
      validateComponentPack({
        ...pack("duplicates", 0),
        components: [component("TextInput"), component("TextInput")],
      }),
    ).toMatchObject({ valid: false });
    expect(
      validateComponentPack({ ...pack("version", 0), version: "latest" }),
    ).toMatchObject({ valid: false });
    expect(
      validateComponentPack({
        ...pack("unsafe", 0),
        agentGuidance: { summary: "eval(payload)" },
      }),
    ).toMatchObject({ valid: false });
    expect(
      validateComponentPack({
        ...pack("framework-prop", 0),
        components: [
          {
            semanticType: "Unsafe",
            propsSchema: { type: "object" },
            extensions: {
              "vendor.pack": {
                version: "1.0.0",
                schema: { type: "object" },
              },
            },
          },
        ],
        className: "leak",
      }),
    ).toMatchObject({ valid: false });
  });

  it("validates namespaced extensions and action input schemas", () => {
    const registry = createStandardComponentRegistry();
    registry.register({
      type: "TeaAction",
      propsSchema: { type: "object", additionalProperties: false },
      actions: [
        {
          name: "select",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            required: ["teaId"],
            properties: { teaId: { type: "string" } },
          },
        },
      ],
      extensions: {
        "tea.display": {
          version: "1.0.0",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["density"],
            properties: { density: { enum: ["compact", "comfortable"] } },
          },
        },
      },
    });
    const surface = {
      id: "tea",
      revision: 0,
      intent: "single-select" as const,
      tree: {
        id: "action",
        component: "TeaAction",
        props: {},
        extensions: {
          "tea.display": {
            version: "1.0.0",
            value: { density: "compact" },
          },
        },
      },
      data: {},
      context: {},
    };
    validateSurface(surface, registry);
    expect(
      createActionIntent(registry, surface, {
        id: "intent-1",
        nodeId: "action",
        action: "select",
        input: { teaId: "longjing" },
      }),
    ).toMatchObject({ action: "select" });
    expect(() =>
      createActionIntent(registry, surface, {
        id: "intent-2",
        nodeId: "action",
        action: "select",
        input: { command: "open" },
      }),
    ).toThrow(DynamicUIError);

    expect(() =>
      validateSurface(
        {
          ...surface,
          tree: {
            ...surface.tree,
            extensions: {
              "tea.display": {
                version: "2.0.0",
                value: { density: "compact" },
              },
            },
          },
        },
        registry,
      ),
    ).toThrow(/requires version 1.0.0/);
  });

  it("does not mutate a Surface when a pack is selected", () => {
    const registry = createStandardComponentRegistry();
    registry.registerPack(pack("one", 0));
    registry.registerPack(pack("two", 0));
    const store = new InMemorySurfaceStore(registry);
    store.createSurface({
      id: "form",
      intent: "form",
      tree: {
        id: "name",
        stableId: "profile.name",
        component: "TextInput",
        props: { label: "Name" },
        binding: { path: "name", valueType: "string" },
      },
      data: { name: "Ada" },
      context: {},
    });
    const before = store.requireSurface("form");
    const resolver = new ComponentPackResolver(registry);
    resolver.resolve({
      semanticType: "TextInput",
      rendererKind: "fake",
      preferredPack: "one",
    });
    resolver.resolve({
      semanticType: "TextInput",
      rendererKind: "fake",
      preferredPack: "two",
    });
    expect(store.requireSurface("form")).toEqual(before);
  });
});
