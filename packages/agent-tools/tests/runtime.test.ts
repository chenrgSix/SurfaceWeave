import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  standardComponentManifests,
} from "@surfaceweave/core";
import { describe, expect, it } from "vitest";

import {
  AgentUIToolRuntime,
  ToolToUIRuntime,
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
  it.each(["host", "agent"])(
    "preserves registered Tool hard constraints for %s-created Surfaces",
    (creator) => {
      const registry = createStandardComponentRegistry();
      const store = new InMemorySurfaceStore(registry);
      const toolRuntime = new ToolToUIRuntime(registry, store);
      toolRuntime.registerTool({
        id: "order.create",
        version: "1.0.0",
        inputSchema: createArguments.schema,
        uiHints: {
          hardConstraints: {
            fields: {
              buyer: {
                component: "TextInput",
                visible: true,
                locked: ["visibility"],
              },
            },
          },
        },
      });
      const input = {
        toolId: "order.create",
        surfaceId: "order",
        initialValues: createArguments.data,
      };
      if (creator === "host") {
        toolRuntime.createToolSurface(input);
      } else {
        const creatorRuntime = new AgentUIToolRuntime(
          registry,
          store,
          undefined,
          toolRuntime,
        );
        expect(creatorRuntime.execute("ui.createToolSurface", input).ok).toBe(
          true,
        );
      }
      // A fresh Agent runtime must recover authority from ToolInvocation,
      // not from its own creation history or Agent-writable Surface context.
      const agent = new AgentUIToolRuntime(
        registry,
        store,
        undefined,
        toolRuntime,
      );
      const before = store.requireSurface("order");
      const rejected = agent.execute("ui.applyOperations", {
        surfaceId: "order",
        baseRevision: 0,
        reason: "Hide the locked buyer",
        operations: [
          { type: "setVisibility", target: "buyer", visible: false },
        ],
      });
      expect(rejected).toMatchObject({
        ok: false,
        error: { code: "HARD_CONSTRAINT_VIOLATION" },
      });
      expect(
        agent.execute("ui.replaceSurface", {
          surfaceId: "order",
          baseRevision: 0,
          surface: {
            intent: "form",
            tree: { ...before.tree, children: [] },
            data: before.data,
            context: {},
          },
        }),
      ).toMatchObject({
        ok: false,
        error: { code: "HARD_CONSTRAINT_VIOLATION" },
      });
      expect(store.requireSurface("order")).toEqual(before);

      expect(
        agent.execute("ui.replaceSurface", {
          surfaceId: "order",
          baseRevision: 0,
          surface: {
            intent: "form",
            tree: before.tree,
            data: before.data,
            context: { toolId: "forged-tool" },
          },
        }).ok,
      ).toBe(true);
      expect(
        agent.execute("ui.applyOperations", {
          surfaceId: "order",
          baseRevision: 1,
          reason: "Try hiding after changing context",
          operations: [
            { type: "setVisibility", target: "buyer", visible: false },
          ],
        }),
      ).toMatchObject({
        ok: false,
        error: { code: "HARD_CONSTRAINT_VIOLATION" },
      });
      expect(
        agent.execute("ui.applyOperations", {
          surfaceId: "order",
          baseRevision: 1,
          reason: "Change an unlocked label",
          operations: [
            { type: "setProps", target: "buyer", props: { label: "Customer" } },
          ],
        }),
      ).toMatchObject({ ok: true, value: { revision: 2 } });
    },
  );

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
    expect(uiToolDefinitions).toHaveLength(14);
    for (const definition of uiToolDefinitions) {
      expect(definition.inputSchema.type).toBe("object");
    }
    const applyOperations = surfaceToolDefinitions.find(
      (definition) => definition.name === "ui.applyOperations",
    );
    expect(JSON.stringify(applyOperations?.inputSchema)).toContain('"columns"');
    expect(JSON.stringify(applyOperations?.inputSchema)).toContain('"compact"');
  });

  it("exposes registered Tool discovery and proposal without allowing Agent registration", () => {
    const registry = createStandardComponentRegistry();
    const store = new InMemorySurfaceStore(registry);
    const toolRuntime = new ToolToUIRuntime(registry, store);
    toolRuntime.registerTool({
      id: "order.create",
      version: "1.0.0",
      inputSchema: {
        type: "object",
        required: ["buyer"],
        properties: { buyer: { type: "string" } },
      },
      annotations: { sideEffect: true, confirmation: "required" },
    });
    const agent = new AgentUIToolRuntime(
      registry,
      store,
      undefined,
      toolRuntime,
    );

    expect(agent.execute("ui.inspectTools", {})).toMatchObject({
      ok: true,
      value: { tools: [{ id: "order.create", version: "1.0.0" }] },
    });
    const created = agent.execute("ui.createToolSurface", {
      toolId: "order.create",
      surfaceId: "agent-order-form",
      initialValues: { buyer: "Ada" },
    });
    expect(created).toMatchObject({
      ok: true,
      value: { invocation: { status: "editing" } },
    });
    if (!created.ok || !("invocation" in created.value)) {
      throw new Error("Tool Surface was not created");
    }
    expect(
      agent.execute("ui.proposeToolSubmission", {
        invocationId: created.value.invocation.id,
      }),
    ).toMatchObject({
      ok: true,
      value: { outcome: "confirmation-required" },
    });
    expect(
      agent.execute("ui.createToolSurface", {
        toolId: "order.create",
        surfaceId: "unsafe",
        url: "https://agent.invalid",
        definition: { id: "forged" },
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_ARGUMENTS" },
    });
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
      undefined,
      undefined,
      {
        clientCapabilities: {
          rendererKind: "flutter",
          enabledPackIds: ["material"],
          terminalCapabilities: ["mobile"],
          supportedPackVersions: { material: ["1.0.0"] },
          runtimeCapabilities: ["operations"],
        },
      },
    );
    const result = runtime.execute("ui.inspectComponentPacks", {
      rendererKind: "flutter",
      capabilities: ["mobile"],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        protocolVersion: "1.0",
        rendererKind: "flutter",
        components: expect.arrayContaining([
          expect.objectContaining({
            type: "TextInput",
            layoutCapabilities: ["span"],
          }),
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

    const forged = runtime.execute("ui.inspectComponentPacks", {
      rendererKind: "react",
      capabilities: ["web", "admin"],
    });
    expect(forged).toMatchObject({
      ok: true,
      value: { packs: [], components: [] },
    });
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

  it("creates portable grouped layouts and rejects renderer-specific props", () => {
    const { runtime, store } = createRuntime();
    const created = runtime.execute("ui.createSurface", {
      ...createArguments,
      surfaceId: "grouped",
      developer: {
        softHints: {
          layout: { columns: 2, gap: 16 },
          groups: {
            delivery: { title: "Delivery", layout: { gap: 8 } },
          },
          fields: {
            buyer: { group: "delivery", layout: { span: 2 } },
          },
        },
      },
    });
    const rejected = runtime.execute("ui.createSurface", {
      ...createArguments,
      surfaceId: "unsafe-layout",
      developer: { softHints: { layout: { className: "grid" } } },
    });

    expect(created).toMatchObject({ ok: true });
    const tree = store.requireSurface("grouped").tree;
    expect(tree).toMatchObject({
      layout: {
        columns: 2,
        gap: 16,
        modes: { compact: { columns: 1 } },
      },
    });
    expect(tree.children?.[0]).toMatchObject({
      component: "Section",
      props: { title: "Delivery" },
    });
    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_ARGUMENTS" },
    });
    expect(store.getSurface("unsafe-layout")).toBeUndefined();
  });

  it("applies operation batches and returns revision conflicts as data", () => {
    const { runtime, store } = createRuntime();
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
        {
          type: "setLayout",
          target: "remark",
          layout: { span: 2, modes: { compact: { span: 1 } } },
        },
      ],
    });
    const invalidLayout = runtime.execute("ui.applyOperations", {
      surfaceId: "purchase",
      baseRevision: 1,
      reason: "Inject renderer props",
      operations: [
        {
          type: "setLayout",
          target: "remark",
          layout: { className: "vendor-grid" },
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
    expect(invalidLayout).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_ARGUMENTS" },
    });
    expect(conflict).toMatchObject({
      ok: false,
      error: { code: "REVISION_CONFLICT" },
    });
    expect(store.requireSurface("purchase").tree.children?.[0]?.layout).toEqual(
      { span: 2, modes: { compact: { span: 1 } } },
    );
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
