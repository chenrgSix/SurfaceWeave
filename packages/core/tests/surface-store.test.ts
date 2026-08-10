import { describe, expect, it, vi } from "vitest";

import { InMemorySurfaceStore, readDataPath } from "../src/index.js";
import type { DynamicUIError, Surface } from "../src/index.js";
import { createFormSurface, createRegistry } from "./fixtures.js";

describe("InMemorySurfaceStore", () => {
  it("isolates observer failures after a committed update", () => {
    const observerErrors: unknown[] = [];
    const store = new InMemorySurfaceStore(createRegistry(), {
      onListenerError(error) {
        observerErrors.push(error);
      },
    });
    const surface = store.createSurface(createFormSurface());
    const healthyListener = vi.fn();
    store.subscribe(surface.id, () => {
      throw new Error("observer failed");
    });
    store.subscribe(surface.id, healthyListener);

    const updated = store.updateData(surface.id, surface.revision, [
      { path: "purchase.name", value: "Lin" },
    ]);

    expect(updated.revision).toBe(1);
    expect(store.requireSurface(surface.id).revision).toBe(1);
    expect(healthyListener).toHaveBeenCalledOnce();
    expect(observerErrors).toEqual([expect.any(Error)]);
  });

  it("rejects resource limits before changing Store state", () => {
    const store = new InMemorySurfaceStore(createRegistry(), {
      limits: { maxNodes: 2, maxOperationsPerBatch: 1 },
    });
    expect(() => store.createSurface(createFormSurface())).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "RESOURCE_POLICY_EXCEEDED",
        details: {
          limit: "maxNodes",
          allowed: 2,
          actual: 3,
          scope: "Surface",
        },
      }),
    );
    expect(store.getSurface("purchase")).toBeUndefined();

    const operationStore = new InMemorySurfaceStore(createRegistry(), {
      limits: { maxOperationsPerBatch: 1 },
    });
    const surface = operationStore.createSurface(createFormSurface());
    expect(() =>
      operationStore.applyOperations(surface.id, surface.revision, [
        {
          type: "setVisibility",
          target: "purchase.name",
          visible: false,
        },
        {
          type: "setVisibility",
          target: "purchase.remark",
          visible: false,
        },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "RESOURCE_POLICY_EXCEEDED",
      }),
    );
    expect(operationStore.requireSurface(surface.id)).toEqual(surface);
  });

  it("disposes in-memory state and subscriptions idempotently", () => {
    const store = new InMemorySurfaceStore(createRegistry());
    const surface = store.createSurface(createFormSurface());
    const listener = vi.fn();
    store.subscribe(surface.id, listener);

    store.dispose();
    store.dispose();

    expect(store.getSurface(surface.id)).toBeUndefined();
    expect(() => store.requireSurface(surface.id)).toThrow(/does not exist/);
  });

  it("does not modify a surface when any operation in a batch is invalid", () => {
    const store = new InMemorySurfaceStore(createRegistry());
    const before = store.createSurface(createFormSurface());
    const listener = vi.fn();
    store.subscribe(before.id, listener);

    expect(() =>
      store.applyOperations(before.id, before.revision, [
        {
          type: "setProps",
          target: "purchase.name",
          props: { label: "Customer" },
        },
        {
          type: "replaceComponent",
          target: "purchase.remark",
          component: "RemoteCode",
        },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "UNKNOWN_COMPONENT",
      }),
    );

    expect(store.requireSurface(before.id)).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("rejects stale base revisions", () => {
    const store = new InMemorySurfaceStore(createRegistry());
    const surface = store.createSurface(createFormSurface());
    store.updateData(surface.id, 0, [
      { path: "purchase.name", value: "Grace" },
    ]);

    expect(() =>
      store.applyOperations(surface.id, 0, [
        {
          type: "setVisibility",
          target: "purchase.remark",
          visible: false,
        },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "REVISION_CONFLICT",
      }),
    );
  });

  it("rejects incompatible bound values without changing state", () => {
    const store = new InMemorySurfaceStore(createRegistry());
    const surface = store.createSurface(createFormSurface());

    expect(() =>
      store.updateData(surface.id, 0, [
        { path: "purchase.name", value: { arbitrary: "object" } },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "INVALID_OPERATION",
      }),
    );
    expect(store.requireSurface(surface.id)).toEqual(surface);
  });

  it("rejects prototype-polluting binding paths", () => {
    const unsafe = createFormSurface();
    const firstNode = unsafe.tree.children?.[0];
    if (firstNode?.binding !== undefined) {
      firstNode.binding.path = "constructor.prototype.polluted";
    }
    const store = new InMemorySurfaceStore(createRegistry());

    expect(() => store.createSurface(unsafe)).toThrowError(
      expect.objectContaining<Partial<DynamicUIError>>({
        code: "INVALID_SURFACE",
      }),
    );
  });

  it("preserves form data when nodes move", () => {
    const store = new InMemorySurfaceStore(createRegistry());
    const surface = store.createSurface(createFormSurface());

    const moved = store.applyOperations(surface.id, 0, [
      {
        type: "moveNode",
        target: "purchase.remark",
        position: "first",
      },
    ]);

    expect(moved.tree.children?.[0]?.stableId).toBe("purchase.remark");
    expect(readDataPath(moved.data, "purchase.name")).toBe("Ada");
    expect(readDataPath(moved.data, "purchase.remark")).toBe("Keep dry");
  });

  it("preserves data for a compatible component replacement", () => {
    const registry = createRegistry();
    registry.register({
      type: "Textarea",
      binding: { valueTypes: ["string"], semantics: ["remark"] },
    });
    const store = new InMemorySurfaceStore(registry);
    const surface = store.createSurface(createFormSurface());

    const replaced = store.applyOperations(surface.id, 0, [
      {
        type: "replaceComponent",
        target: "purchase.remark",
        component: "Textarea",
      },
    ]);

    expect(replaced.tree.children?.[1]?.component).toBe("Textarea");
    expect(readDataPath(replaced.data, "purchase.remark")).toBe("Keep dry");
  });

  it("migrates compatible values by stableId when replacing a surface", () => {
    const store = new InMemorySurfaceStore(createRegistry());
    const current = store.createSurface(createFormSurface());
    const replacement: Omit<Surface, "id" | "revision"> = {
      intent: "form",
      tree: {
        id: "replacement-root",
        component: "Form",
        props: {},
        children: [
          {
            id: "replacement-name",
            stableId: "purchase.name",
            component: "TextInput",
            props: { label: "Buyer" },
            binding: {
              path: "order.buyer",
              valueType: "string",
              semantic: "customer-name",
            },
          },
        ],
      },
      data: { order: { buyer: "Default" } },
      context: { source: "replacement" },
    };

    const next = store.replaceSurface(current.id, 0, replacement);

    expect(readDataPath(next.data, "order.buyer")).toBe("Ada");
    expect(next.revision).toBe(1);
  });

  it("emits deterministic committed events", () => {
    const store = new InMemorySurfaceStore(createRegistry());
    const surface = store.createSurface(createFormSurface());
    const events: string[] = [];
    store.subscribe(surface.id, (event) => {
      events.push(`${event.sequence}:${event.type}:${event.revision}`);
    });

    store.updateData(surface.id, 0, [{ path: "purchase.name", value: "Lin" }]);
    store.applyOperations(surface.id, 1, [
      {
        type: "setVisibility",
        target: "purchase.remark",
        visible: false,
      },
    ]);

    expect(events).toEqual([
      "2:surface.dataChanged:1",
      "3:surface.operationsApplied:2",
    ]);
  });
});
