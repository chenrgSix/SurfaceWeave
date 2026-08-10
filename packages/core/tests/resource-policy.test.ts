import {
  InMemorySurfaceStore,
  assertOperationResourcePolicy,
  resolveSurfaceResourcePolicy,
  type DynamicUIError,
  type JsonObject,
  type Surface,
} from "../src/index.js";
import { describe, expect, it, vi } from "vitest";

import { createFormSurface, createRegistry } from "./fixtures.js";

function expectLimit(
  operation: () => unknown,
  limit: string,
  allowed: number,
): void {
  expect(operation).toThrowError(
    expect.objectContaining<Partial<DynamicUIError>>({
      code: "RESOURCE_POLICY_EXCEEDED",
      details: expect.objectContaining({ limit, allowed }),
    }),
  );
}

describe("Surface Resource Policy", () => {
  it("is explicitly enabled and preserves unconfigured RC.3 acceptance", () => {
    const unbounded = new InMemorySurfaceStore(createRegistry());
    const input = createFormSurface();
    input.context.large = "x".repeat(100_001);
    expect(unbounded.createSurface(input).context.large).toHaveLength(100_001);
    expect(unbounded.getResourcePolicySummary()).toEqual({ enabled: false });

    const bounded = new InMemorySurfaceStore(createRegistry(), {
      resourcePolicy: { maxStringLength: 20 },
    });
    expect(bounded.getResourcePolicySummary()).toMatchObject({
      enabled: true,
      limits: { maxStringLength: 20 },
    });
    expectLimit(
      () =>
        bounded.createSurface({
          ...createFormSurface(),
          id: "bounded",
          context: { note: "x".repeat(21) },
        }),
      "maxStringLength",
      20,
    );
  });

  it("enforces node, tree-depth, string, byte, and batch boundaries", () => {
    expect(
      new InMemorySurfaceStore(createRegistry(), {
        resourcePolicy: { maxNodes: 3, maxTreeDepth: 2 },
      }).createSurface(createFormSurface()),
    ).toBeDefined();
    expectLimit(
      () =>
        new InMemorySurfaceStore(createRegistry(), {
          resourcePolicy: { maxNodes: 2 },
        }).createSurface(createFormSurface()),
      "maxNodes",
      2,
    );
    expectLimit(
      () =>
        new InMemorySurfaceStore(createRegistry(), {
          resourcePolicy: { maxTreeDepth: 1 },
        }).createSurface(createFormSurface()),
      "maxTreeDepth",
      1,
    );

    const candidate: Surface = { ...createFormSurface(), revision: 0 };
    const exactBytes = Buffer.byteLength(JSON.stringify(candidate), "utf8");
    expect(
      new InMemorySurfaceStore(createRegistry(), {
        resourcePolicy: { maxSurfaceBytes: exactBytes },
      }).createSurface(createFormSurface()),
    ).toBeDefined();
    expectLimit(
      () =>
        new InMemorySurfaceStore(createRegistry(), {
          resourcePolicy: { maxSurfaceBytes: exactBytes - 1 },
        }).createSurface(createFormSurface()),
      "maxSurfaceBytes",
      exactBytes - 1,
    );

    const store = new InMemorySurfaceStore(createRegistry(), {
      resourcePolicy: { maxOperationsPerBatch: 1 },
    });
    const surface = store.createSurface(createFormSurface());
    expect(
      store.applyOperations(surface.id, surface.revision, [
        { type: "setVisibility", target: "purchase.name", visible: false },
      ]),
    ).toBeDefined();
    expectLimit(
      () =>
        store.applyOperations(surface.id, surface.revision + 1, [
          { type: "setVisibility", target: "purchase.name", visible: true },
          { type: "setVisibility", target: "purchase.remark", visible: false },
        ]),
      "maxOperationsPerBatch",
      1,
    );
  });

  it("atomically rejects create, update, replace, and operations", () => {
    const createStore = new InMemorySurfaceStore(createRegistry(), {
      resourcePolicy: { maxNodes: 2 },
    });
    expect(() => createStore.createSurface(createFormSurface())).toThrow();
    expect(createStore.getSurface("purchase")).toBeUndefined();

    const store = new InMemorySurfaceStore(createRegistry(), {
      resourcePolicy: { maxStringLength: 30 },
    });
    const before = store.createSurface(createFormSurface());
    const listener = vi.fn();
    store.subscribe(before.id, listener);
    const tooLong = "x".repeat(31);

    expectLimit(
      () =>
        store.updateData(before.id, before.revision, [
          { path: "purchase.name", value: tooLong },
        ]),
      "maxStringLength",
      30,
    );
    expectLimit(
      () =>
        store.applyOperations(before.id, before.revision, [
          {
            type: "setProps",
            target: "purchase.name",
            props: { label: tooLong },
          },
        ]),
      "maxStringLength",
      30,
    );
    expectLimit(
      () =>
        store.replaceSurface(before.id, before.revision, {
          ...createFormSurface(),
          context: { note: tooLong },
        }),
      "maxStringLength",
      30,
    );
    expect(store.requireSurface(before.id)).toEqual(before);
    expect(listener).not.toHaveBeenCalled();

    const updated = store.updateData(before.id, before.revision, [
      { path: "purchase.name", value: "Lin" },
    ]);
    expect(updated.revision).toBe(1);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ sequence: 2 });
  });

  it("rejects cycles, prototype pollution, abnormal nesting, and sparse arrays", () => {
    const cyclic = createFormSurface();
    (cyclic.context as JsonObject).self =
      cyclic.context as unknown as JsonObject;
    expect(() =>
      new InMemorySurfaceStore(createRegistry()).createSurface(cyclic),
    ).toThrow(/cyclic/);

    const polluted = createFormSurface();
    polluted.context = JSON.parse('{"__proto__":{"admin":true}}') as JsonObject;
    expect(() =>
      new InMemorySurfaceStore(createRegistry()).createSurface(polluted),
    ).toThrow(/safe JSON property/);

    const nested: Record<string, unknown> = {};
    let cursor = nested;
    for (let index = 0; index < 5; index += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    const deep = createFormSurface();
    deep.context = nested as JsonObject;
    expectLimit(
      () =>
        new InMemorySurfaceStore(createRegistry(), {
          resourcePolicy: { maxJsonDepth: 4 },
        }).createSurface(deep),
      "maxJsonDepth",
      4,
    );

    const sparse = new Array(5) as unknown[];
    expectLimit(
      () =>
        assertOperationResourcePolicy(
          sparse as never[],
          resolveSurfaceResourcePolicy({ maxJsonValues: 3 }),
        ),
      "maxJsonValues",
      3,
    );
  });
});
