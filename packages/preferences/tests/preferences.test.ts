import {
  ComponentPackResolver,
  applyOperationsToSurface,
  createStandardComponentRegistry,
  standardComponentManifests,
  type PreferenceDocument,
  type PreferenceEvent,
  type PreferencePatch,
  type Surface,
} from "@surfaceweave/core";
import { MemoryStorageAdapter } from "@surfaceweave/storage";
import { describe, expect, it } from "vitest";

import { PreferenceRepository, PreferenceService } from "../src/index.js";

function defaultSurface(
  stableId = "purchase.remark",
  schemaVersion = "2",
): Surface {
  return {
    id: "purchase",
    revision: 0,
    intent: "form",
    schemaRef: { id: "purchase-schema", version: schemaVersion },
    tree: {
      id: "form",
      stableId: "purchase.root",
      component: "Form",
      props: { title: "Purchase" },
      children: [
        {
          id: "remark",
          stableId,
          component: "TextInput",
          props: { label: "Remark", collapsed: false },
          binding: { path: "remark", valueType: "string" },
        },
      ],
    },
    data: { remark: "Keep dry" },
    context: {},
  };
}

function propsPatch(
  id: string,
  scope: PreferencePatch["scope"],
  label: string,
  extra: Partial<PreferencePatch> = {},
): PreferencePatch {
  return {
    id,
    scope,
    targetStableId: "purchase.remark",
    operation: {
      type: "setProps",
      target: "purchase.remark",
      props: { label },
    },
    ...extra,
  };
}

async function createService(initial: PreferencePatch[] = []) {
  const adapter = new MemoryStorageAdapter<PreferenceDocument>({
    version: 1,
    patches: initial,
  });
  const repository = new PreferenceRepository(adapter);
  const registry = createStandardComponentRegistry();
  const service = new PreferenceService(repository, registry);
  await service.hydrate();
  return { adapter, repository, registry, service };
}

describe("PreferenceService", () => {
  it("applies global, intent, and tool scopes in deterministic precedence", async () => {
    const { service } = await createService([
      propsPatch("global", "global", "Global"),
      propsPatch("intent", "intent", "Intent", { intent: "form" }),
      propsPatch("tool", "tool", "Tool", { toolId: "purchase.create" }),
    ]);

    const toolResult = service.applyPreferences(defaultSurface(), {
      toolId: "purchase.create",
    });
    const intentResult = service.applyPreferences(defaultSurface(), {
      toolId: "other.tool",
    });

    expect(toolResult.appliedPatchIds).toEqual(["global", "intent", "tool"]);
    expect(toolResult.surface.tree.children?.[0]?.props.label).toBe("Tool");
    expect(intentResult.appliedPatchIds).toEqual(["global", "intent"]);
    expect(intentResult.surface.tree.children?.[0]?.props.label).toBe("Intent");
  });

  it("blocks preferences and temporary Agent overrides at hard constraints", async () => {
    const patch: PreferencePatch = {
      id: "hide-remark",
      scope: "global",
      targetStableId: "purchase.remark",
      operation: {
        type: "setVisibility",
        target: "purchase.remark",
        visible: false,
      },
    };
    const { service } = await createService([patch]);
    const events: PreferenceEvent[] = [];
    service.subscribe((event) => events.push(event));
    const constraints = {
      fields: {
        "purchase.remark": {
          visible: true,
          locked: ["visibility" as const],
        },
      },
    };

    const result = service.applyPreferences(defaultSurface(), {
      hardConstraints: constraints,
    });

    expect(result.appliedPatchIds).toEqual([]);
    expect(result.conflicts[0]?.code).toBe("HARD_CONSTRAINT");
    expect(events[0]?.type).toBe("preference.conflicted");
    expect(() =>
      service.assertTemporaryOperationsAllowed(
        result.surface,
        [
          {
            type: "setVisibility",
            target: "purchase.remark",
            visible: false,
          },
        ],
        constraints,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "HARD_CONSTRAINT_VIOLATION" }),
    );
  });

  it("keeps layout hard constraints above preferences and Agent overrides", async () => {
    const surface = defaultSurface();
    const field = surface.tree.children?.[0];
    if (field === undefined) throw new Error("Missing remark field");
    field.layout = { span: 1 };
    const patch: PreferencePatch = {
      id: "wide-remark",
      scope: "global",
      targetStableId: "purchase.remark",
      operation: {
        type: "setLayout",
        target: "purchase.remark",
        layout: { span: 2 },
      },
    };
    const { service } = await createService([patch]);
    const constraints = {
      fields: {
        "purchase.remark": { locked: ["layout" as const] },
      },
    };

    const result = service.applyPreferences(surface, {
      hardConstraints: constraints,
    });

    expect(result.appliedPatchIds).toEqual([]);
    expect(result.conflicts[0]?.code).toBe("HARD_CONSTRAINT");
    expect(result.surface.tree.children?.[0]?.layout).toEqual({ span: 1 });
    expect(() =>
      service.assertTemporaryOperationsAllowed(
        result.surface,
        [
          {
            type: "setLayout",
            target: "purchase.remark",
            layout: { span: 2 },
          },
        ],
        constraints,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "HARD_CONSTRAINT_VIOLATION" }),
    );
  });

  it("lets Agent operations override applied preferences without persisting them", async () => {
    const { registry, service } = await createService([
      propsPatch("collapsed", "global", "Preference"),
    ]);
    const personalized = service.applyPreferences(defaultSurface()).surface;
    const before = service.listPreferences();
    const operations = [
      {
        type: "setProps" as const,
        target: "purchase.remark",
        props: { label: "Temporary Agent override" },
      },
    ];

    service.assertTemporaryOperationsAllowed(personalized, operations);
    const temporary = applyOperationsToSurface(
      personalized,
      operations,
      registry,
    );

    expect(temporary.tree.children?.[0]?.props.label).toBe(
      "Temporary Agent override",
    );
    expect(service.listPreferences()).toEqual(before);
  });

  it("keeps applied preference patches and data when the renderer pack changes", async () => {
    const { registry, service } = await createService([
      {
        id: "collapse-remark",
        scope: "global",
        targetStableId: "purchase.remark",
        operation: {
          type: "setProps",
          target: "purchase.remark",
          props: { collapsed: true },
        },
      },
    ]);
    const textInput = standardComponentManifests.find(
      (component) => component.semanticType === "TextInput",
    );
    expect(textInput).toBeDefined();
    for (const id of ["plain", "material"] as const) {
      registry.registerPack({
        protocolVersion: "1.0",
        id,
        version: "1.0.0",
        rendererKind: "fake",
        components: [textInput!],
      });
    }
    const personalized = service.applyPreferences(defaultSurface()).surface;
    const resolver = new ComponentPackResolver(registry);

    expect(
      resolver.resolve({
        semanticType: "TextInput",
        rendererKind: "fake",
        preferredPack: "plain",
      }).packId,
    ).toBe("plain");
    expect(
      resolver.resolve({
        semanticType: "TextInput",
        rendererKind: "fake",
        preferredPack: "material",
      }).packId,
    ).toBe("material");
    expect(personalized.tree.children?.[0]?.props.collapsed).toBe(true);
    expect(personalized.data).toEqual({ remark: "Keep dry" });
    expect(service.listPreferences()).toHaveLength(1);
  });

  it("detects schema aliases and persists only an explicit migration", async () => {
    const oldPatch: PreferencePatch = {
      id: "old-remark",
      scope: "global",
      targetStableId: "old.remark",
      schemaRef: { id: "purchase-schema", version: "1" },
      operation: {
        type: "setProps",
        target: "old.remark",
        props: { collapsed: true },
      },
    };
    const { service } = await createService([oldPatch]);
    const events: PreferenceEvent[] = [];
    service.subscribe((event) => events.push(event));

    const first = service.applyPreferences(defaultSurface(), {
      fieldAliases: { "old.remark": "purchase.remark" },
    });
    const conflict = first.conflicts[0];

    expect(conflict).toMatchObject({
      code: "SCHEMA_VERSION_MISMATCH",
      suggestedStableIds: ["purchase.remark"],
    });
    expect(service.listPreferences()[0]?.targetStableId).toBe("old.remark");

    const migrated = await service.migratePreference(
      conflict?.id ?? "missing",
      "purchase.remark",
    );

    expect(migrated).toMatchObject({
      targetStableId: "purchase.remark",
      schemaRef: { id: "purchase-schema", version: "2" },
    });
    expect(events.at(-1)?.type).toBe("preference.migrated");
    expect(service.applyPreferences(defaultSurface()).appliedPatchIds).toEqual([
      "old-remark",
    ]);
  });

  it("discards a conflicted preference only after explicit resolution", async () => {
    const missing = propsPatch("missing", "global", "Missing");
    missing.targetStableId = "removed.field";
    missing.operation.target = "removed.field";
    const { service } = await createService([missing]);
    const result = service.applyPreferences(defaultSurface());
    const conflictId = result.conflicts[0]?.id ?? "missing";

    expect(service.listPreferences()).toHaveLength(1);
    await service.discardConflict(conflictId);

    expect(service.listPreferences()).toEqual([]);
    expect(service.listConflicts()).toEqual([]);
  });

  it("reports ambiguous aliases without choosing for the user", async () => {
    const oldPatch: PreferencePatch = {
      id: "ambiguous",
      scope: "global",
      targetStableId: "old.remark",
      operation: {
        type: "setProps",
        target: "old.remark",
        props: { collapsed: true },
      },
    };
    const { service } = await createService([oldPatch]);
    const surface = defaultSurface();
    surface.tree.children?.push({
      id: "alternate",
      stableId: "purchase.notes",
      component: "TextInput",
      props: { label: "Notes" },
      binding: { path: "notes", valueType: "string" },
    });
    surface.data.notes = "";

    const result = service.applyPreferences(surface, {
      fieldAliases: {
        "old.remark": ["purchase.remark", "purchase.notes"],
      },
    });

    expect(result.conflicts[0]).toMatchObject({
      code: "ALIAS_AMBIGUOUS",
      suggestedStableIds: ["purchase.notes", "purchase.remark"],
    });
    expect(result.appliedPatchIds).toEqual([]);
  });
});

describe("PreferenceRepository", () => {
  it("requires hydration and publishes only after durable save", async () => {
    const adapter = new MemoryStorageAdapter<PreferenceDocument>();
    const repository = new PreferenceRepository(adapter);
    expect(() => repository.list()).toThrowError(
      expect.objectContaining({ code: "PREFERENCES_NOT_HYDRATED" }),
    );

    await repository.hydrate();
    await repository.upsert(propsPatch("saved", "global", "Saved"));

    expect((await adapter.load())?.patches[0]?.id).toBe("saved");
  });

  it("does not publish a cache mutation when persistence fails", async () => {
    const adapter = {
      load: async () => ({ version: 1 as const, patches: [] }),
      save: async () => {
        throw new Error("backend unavailable");
      },
      clear: async () => undefined,
    };
    const repository = new PreferenceRepository(adapter);
    await repository.hydrate();

    await expect(
      repository.upsert(propsPatch("not-saved", "global", "Unsaved")),
    ).rejects.toThrow("backend unavailable");
    expect(repository.list()).toEqual([]);
  });

  it("keeps the last valid runtime state when rehydration data is invalid", async () => {
    let stored: unknown = {
      version: 1,
      patches: [propsPatch("valid", "global", "Valid")],
    };
    const repository = new PreferenceRepository({
      load: async () => stored as PreferenceDocument,
      save: async (value) => {
        stored = value;
      },
      clear: async () => undefined,
    });
    await repository.hydrate();

    for (const invalid of [
      { version: 2, patches: [] },
      { version: 1, patches: [{ id: "broken" }] },
    ]) {
      stored = invalid;
      await expect(repository.hydrate()).rejects.toMatchObject({
        code: "INVALID_PREFERENCE",
      });
      expect(repository.list().map((patch) => patch.id)).toEqual(["valid"]);
    }
  });
});
