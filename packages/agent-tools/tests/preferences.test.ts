import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
} from "@package-first/core";
import type { PreferenceDocument } from "@package-first/core";
import {
  PreferenceRepository,
  PreferenceService,
} from "@package-first/preferences";
import {
  MemoryStorageAdapter,
  StorageAdapterError,
} from "@package-first/storage";
import { beforeEach, describe, expect, it } from "vitest";

import {
  AgentUIToolRuntime,
  PreferenceAgentToolRuntime,
} from "../src/index.js";

const schema = {
  type: "object" as const,
  properties: {
    buyer: { type: "string" as const },
    remark: { type: "string" as const },
  },
};

function preference(targetStableId = "remark") {
  return {
    id: "hide-remark",
    scope: "global" as const,
    targetStableId,
    schemaRef: { id: "purchase", version: "1" },
    operation: {
      type: "setVisibility" as const,
      target: targetStableId,
      visible: false,
    },
  };
}

describe("Agent preference tools", () => {
  const registry = createStandardComponentRegistry();
  let service: PreferenceService;
  let tools: PreferenceAgentToolRuntime;

  beforeEach(async () => {
    const repository = new PreferenceRepository(
      new MemoryStorageAdapter<PreferenceDocument>(),
    );
    service = new PreferenceService(repository, registry);
    await service.hydrate();
    tools = new PreferenceAgentToolRuntime(service);
  });

  it("requires explicit confirmation before persisting a preference", async () => {
    const rejected = await tools.execute("ui.savePreference", {
      confirmed: false,
      preference: preference(),
    });
    const saved = await tools.execute("ui.savePreference", {
      confirmed: true,
      preference: preference(),
    });

    expect(rejected).toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_ARGUMENTS" },
    });
    expect(saved).toMatchObject({ ok: true, value: { id: "hide-remark" } });
    expect(service.listPreferences()).toHaveLength(1);
  });

  it("applies persisted preferences but keeps Agent operations temporary", async () => {
    await service.savePreference(preference());
    const store = new InMemorySurfaceStore(registry);
    const surfaces = new AgentUIToolRuntime(registry, store, service);

    const created = surfaces.createSurface({
      surfaceId: "purchase",
      schema,
      data: { buyer: "Ada", remark: "Keep dry" },
      intent: "form",
      schemaRef: { id: "purchase", version: "1" },
    });
    const override = surfaces.applyOperations({
      surfaceId: "purchase",
      baseRevision: 0,
      reason: "Temporarily show the remark",
      operations: [{ type: "setVisibility", target: "remark", visible: true }],
    });

    expect(created).toMatchObject({
      ok: true,
      value: {
        tree: {
          children: expect.arrayContaining([
            expect.objectContaining({ stableId: "remark", visible: false }),
          ]),
        },
      },
    });
    expect(override).toMatchObject({ ok: true, value: { revision: 1 } });
    expect(service.listPreferences()).toEqual([preference()]);
  });

  it("lets a durable preference override a developer soft hint", async () => {
    await service.savePreference({
      id: "preferred-label",
      scope: "global",
      targetStableId: "buyer",
      operation: {
        type: "setProps",
        target: "buyer",
        props: { label: "Preferred buyer" },
      },
    });
    const store = new InMemorySurfaceStore(registry);
    const surfaces = new AgentUIToolRuntime(registry, store, service);

    const created = surfaces.createSurface({
      surfaceId: "purchase",
      schema,
      data: {},
      intent: "form",
      developer: {
        softHints: { fields: { buyer: { label: "Developer buyer" } } },
      },
    });

    expect(created).toMatchObject({
      ok: true,
      value: {
        tree: {
          children: expect.arrayContaining([
            expect.objectContaining({
              stableId: "buyer",
              props: expect.objectContaining({ label: "Preferred buyer" }),
            }),
          ]),
        },
      },
    });
  });

  it("rejects temporary operations and replacements that violate hard constraints", () => {
    const store = new InMemorySurfaceStore(registry);
    const surfaces = new AgentUIToolRuntime(registry, store, service);
    surfaces.createSurface({
      surfaceId: "purchase",
      schema,
      data: {},
      intent: "form",
      developer: {
        hardConstraints: {
          fields: {
            buyer: { component: "TextInput", visible: true },
          },
        },
      },
    });

    const operation = surfaces.applyOperations({
      surfaceId: "purchase",
      baseRevision: 0,
      reason: "Try another component",
      operations: [
        {
          type: "replaceComponent",
          target: "buyer",
          component: "TextArea",
        },
      ],
    });
    const replacement = surfaces.replaceSurface({
      surfaceId: "purchase",
      baseRevision: 0,
      surface: {
        intent: "form",
        tree: { id: "root", component: "Form", props: {}, children: [] },
        data: {},
        context: {},
      },
    });

    expect(operation).toMatchObject({
      ok: false,
      error: { code: "HARD_CONSTRAINT_VIOLATION" },
    });
    expect(replacement).toMatchObject({
      ok: false,
      error: { code: "HARD_CONSTRAINT_VIOLATION" },
    });
    expect(store.requireSurface("purchase").revision).toBe(0);
  });

  it("exposes conflicts for explicit migration and discard", async () => {
    await service.savePreference(preference("legacyRemark"));
    const store = new InMemorySurfaceStore(registry);
    const surfaces = new AgentUIToolRuntime(registry, store, service);
    surfaces.createSurface({
      surfaceId: "purchase",
      schema,
      data: {},
      intent: "form",
      schemaRef: { id: "purchase", version: "2" },
      fieldAliases: { legacyRemark: "remark" },
    });

    const inspected = tools.inspectPreferences({});
    expect(inspected).toMatchObject({
      ok: true,
      value: {
        conflicts: [
          expect.objectContaining({
            code: "SCHEMA_VERSION_MISMATCH",
            suggestedStableIds: ["remark"],
          }),
        ],
      },
    });
    if (!inspected.ok) {
      throw new Error("Expected preference inspection to succeed");
    }
    const conflictId = inspected.value.conflicts[0]?.id;
    expect(conflictId).toBeDefined();

    const migrated = await tools.execute("ui.migratePreference", {
      conflictId,
      targetStableId: "remark",
    });
    expect(migrated).toMatchObject({
      ok: true,
      value: { targetStableId: "remark", schemaRef: { version: "2" } },
    });

    await service.savePreference(preference("legacyRemark"));
    surfaces.replaceSurface({
      surfaceId: "purchase",
      baseRevision: 0,
      surface: {
        intent: "form",
        schemaRef: { id: "purchase", version: "2" },
        tree: store.requireSurface("purchase").tree,
        data: {},
        context: {},
      },
    });
    service.applyPreferences(store.requireSurface("purchase"), {
      schemaRef: { id: "purchase", version: "2" },
      fieldAliases: { legacyRemark: "remark" },
    });
    const nextConflict = service.listConflicts()[0];
    expect(nextConflict).toBeDefined();
    const discarded = await tools.execute("ui.discardPreference", {
      conflictId: nextConflict?.id,
    });
    expect(discarded).toMatchObject({
      ok: true,
      value: { preferenceId: "hide-remark" },
    });
    expect(service.listPreferences()).toEqual([]);
  });

  it("rejects executable or unstructured fields in persisted patches", async () => {
    const result = await tools.execute("ui.savePreference", {
      confirmed: true,
      preference: { ...preference(), execute: "alert(1)" },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_PREFERENCE" },
    });
  });

  it("preserves hydration and storage error codes", async () => {
    const unhydrated = new PreferenceService(
      new PreferenceRepository(new MemoryStorageAdapter<PreferenceDocument>()),
      registry,
    );
    const unhydratedTools = new PreferenceAgentToolRuntime(unhydrated);
    expect(unhydratedTools.inspectPreferences({})).toMatchObject({
      ok: false,
      error: { code: "PREFERENCES_NOT_HYDRATED" },
    });

    const failingRepository = new PreferenceRepository({
      load: async () => undefined,
      save: async () => {
        throw new StorageAdapterError(
          "STORAGE_WRITE_FAILED",
          "Backend is unavailable",
        );
      },
      clear: async () => undefined,
    });
    const failingService = new PreferenceService(failingRepository, registry);
    await failingService.hydrate();
    const failingTools = new PreferenceAgentToolRuntime(failingService);
    const result = await failingTools.savePreference({
      confirmed: true,
      preference: preference(),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "STORAGE_WRITE_FAILED" },
    });
  });
});
