import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  standardComponentManifests,
} from "@package-first/core";
import { describe, expect, it } from "vitest";

import {
  AgentUIToolRuntime,
  surfaceToolDefinitions,
  uiToolDefinitions,
} from "../src/index.js";

function createRuntime() {
  const registry = createStandardComponentRegistry();
  const store = new InMemorySurfaceStore(registry);
  return { runtime: new AgentUIToolRuntime(registry, store), store };
}

const createArguments = {
  surfaceId: "purchase",
  schema: {
    type: "object",
    properties: {
      buyer: { type: "string", title: "Buyer" },
      remark: { type: "string", title: "Remark" },
    },
  },
  intent: "form",
  data: { buyer: "Ada", remark: "Keep dry" },
};

describe("AgentUIToolRuntime", () => {
  it("publishes framework-agnostic definitions for all required tools", () => {
    expect(surfaceToolDefinitions.map((definition) => definition.name)).toEqual(
      [
        "ui.createSurface",
        "ui.inspectSurface",
        "ui.inspectComponentPacks",
        "ui.applyOperations",
        "ui.replaceSurface",
      ],
    );
    expect(uiToolDefinitions).toHaveLength(9);
    for (const definition of uiToolDefinitions) {
      expect(definition.inputSchema.type).toBe("object");
    }
  });

  it("discovers only serializable semantic manifests, schemas, and guidance", () => {
    const registry = createStandardComponentRegistry();
    const textInput = standardComponentManifests.find(
      (component) => component.semanticType === "TextInput",
    );
    expect(textInput).toBeDefined();
    registry.registerPack({
      protocolVersion: "1.0",
      id: "material",
      version: "1.0.0",
      rendererKind: "flutter",
      capabilities: ["mobile"],
      components: [textInput!],
      agentGuidance: { summary: "Portable material field semantics." },
    });
    const runtime = new AgentUIToolRuntime(
      registry,
      new InMemorySurfaceStore(registry),
    );
    const result = runtime.execute("ui.inspectComponentPacks", {
      rendererKind: "flutter",
      capabilities: ["mobile"],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        protocolVersion: "1.0",
        components: expect.arrayContaining([
          expect.objectContaining({ type: "ChoiceField" }),
        ]),
        packs: [
          expect.objectContaining({ id: "material", rendererKind: "flutter" }),
        ],
      },
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(JSON.stringify(result)).not.toMatch(
      /ReactNode|JSX|className|onClick|function\s*\(/,
    );
  });

  it("creates and inspects a surface", () => {
    const { runtime } = createRuntime();

    const created = runtime.execute("ui.createSurface", createArguments);
    const inspected = runtime.execute("ui.inspectSurface", {
      surfaceId: "purchase",
    });

    expect(created).toMatchObject({ ok: true, value: { revision: 0 } });
    expect(inspected).toMatchObject({
      ok: true,
      value: {
        id: "purchase",
        revision: 0,
        dataPaths: ["buyer", "remark"],
      },
    });
  });

  it("validates tool arguments without modifying store state", () => {
    const { runtime, store } = createRuntime();

    const result = runtime.execute("ui.createSurface", {
      ...createArguments,
      execute: "arbitrary-code",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_TOOL_ARGUMENTS",
        message: "arguments.execute is not supported",
      },
    });
    expect(store.getSurface("purchase")).toBeUndefined();
  });

  it("applies operation batches and returns revision conflicts as data", () => {
    const { runtime } = createRuntime();
    runtime.createSurface(createArguments);

    const applied = runtime.execute("ui.applyOperations", {
      surfaceId: "purchase",
      baseRevision: 0,
      reason: "Put remarks first",
      operations: [
        { type: "moveNode", target: "remark", position: "first" },
        {
          type: "setProps",
          target: "remark",
          props: { collapsed: true },
        },
      ],
    });
    const conflict = runtime.execute("ui.applyOperations", {
      surfaceId: "purchase",
      baseRevision: 0,
      reason: "Stale update",
      operations: [{ type: "setVisibility", target: "remark", visible: false }],
    });

    expect(applied).toMatchObject({ ok: true, value: { revision: 1 } });
    expect(conflict).toMatchObject({
      ok: false,
      error: { code: "REVISION_CONFLICT" },
    });
  });

  it("replaces a surface and migrates compatible stable bindings", () => {
    const { runtime } = createRuntime();
    runtime.createSurface(createArguments);

    const result = runtime.execute("ui.replaceSurface", {
      surfaceId: "purchase",
      baseRevision: 0,
      surface: {
        intent: "form",
        tree: {
          id: "next-root",
          component: "Form",
          props: {},
          children: [
            {
              id: "next-buyer",
              stableId: "buyer",
              component: "TextInput",
              props: { label: "Purchaser" },
              binding: {
                path: "order.buyer",
                valueType: "string",
              },
            },
          ],
        },
        data: { order: { buyer: "Default" } },
        context: {},
      },
    });

    expect(result).toMatchObject({
      ok: true,
      value: { revision: 1, data: { order: { buyer: "Ada" } } },
    });
  });
});
