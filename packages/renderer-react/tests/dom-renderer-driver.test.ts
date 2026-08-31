// @vitest-environment jsdom

import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  surfaceObservation,
  type ActionIntent,
  type ActionExecutionSnapshot,
  type ActionExecutionStateListener,
  type ActionExecutionStateSource,
  type SurfaceObservationListener,
} from "@surfaceweave/core";
import { fireEvent } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { createReactDOMRendererDriver } from "../src/dom.js";
import { createStandardReactComponentRegistry } from "../src/index.js";

class TestActionStateSource implements ActionExecutionStateSource {
  readonly listeners = new Map<string, Set<ActionExecutionStateListener>>();

  get activeSubscriptions(): number {
    return [...this.listeners.values()].reduce(
      (total, listeners) => total + listeners.size,
      0,
    );
  }

  getSnapshot(surfaceId: string): ActionExecutionSnapshot {
    return {
      surfaceId,
      interactionDisabled: surfaceId === "purchase",
      states:
        surfaceId === "purchase"
          ? [
              {
                intentId: "purchase-submit",
                idempotencyKey: "purchase-1",
                surfaceId,
                nodeId: "form",
                action: "tool.submit",
                status: "pending",
                attempt: 1,
                startedAt: 1,
              },
            ]
          : [],
    };
  }

  subscribe(
    surfaceId: string,
    listener: ActionExecutionStateListener,
  ): () => void {
    const listeners = this.listeners.get(surfaceId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(surfaceId, listeners);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(surfaceId);
    };
  }
}

function createRuntime() {
  const registry = createStandardComponentRegistry();
  const store = new InMemorySurfaceStore(registry);
  store.createSurface({
    id: "purchase",
    intent: "form",
    tree: {
      id: "form",
      component: "Form",
      props: { title: "Purchase" },
      children: [
        {
          id: "buyer",
          component: "TextInput",
          props: { label: "Buyer" },
          binding: { path: "buyer", valueType: "string" },
        },
      ],
    },
    data: { buyer: "Ada" },
    context: {},
  });
  store.createSurface({
    id: "teas",
    intent: "multi-select",
    tree: {
      id: "tea-cards",
      component: "CardList",
      props: {
        title: "Tea",
        multiple: true,
        items: [{ id: "longjing", name: "Longjing" }],
      },
      binding: { path: "selection", valueType: "array" },
    },
    data: { selection: [] },
    context: {},
  });
  return { registry, store };
}

describe("createReactDOMRendererDriver", () => {
  it("validates the initial Surface before creating a React root", async () => {
    const { registry, store } = createRuntime();
    const driver = createReactDOMRendererDriver({
      store,
      componentRegistry: registry,
      reactComponents: createStandardReactComponentRegistry(registry),
    });
    const target = document.createElement("div");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() =>
      driver.mount(target, { surfaceId: "missing", mode: "compact" }),
    ).toThrow('Surface "missing" does not exist');
    let handle: ReturnType<typeof driver.mount>;
    await act(async () => {
      handle = driver.mount(target, {
        surfaceId: "purchase",
        mode: "compact",
      });
    });
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(
      /already been passed to createRoot/,
    );
    await act(async () => handle.unmount());
    consoleError.mockRestore();
  });

  it("mounts shared views, updates references, forwards actions, and cleans subscriptions", async () => {
    const { registry, store } = createRuntime();
    const observation = store[surfaceObservation];
    const originalSubscribe = observation.subscribe.bind(observation);
    let activeSubscriptions = 0;
    vi.spyOn(observation, "subscribe").mockImplementation(
      (surfaceId: string, listener: SurfaceObservationListener) => {
        activeSubscriptions += 1;
        const unsubscribe = originalSubscribe(surfaceId, listener);
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          activeSubscriptions -= 1;
          unsubscribe();
        };
      },
    );
    const onActionIntent = vi.fn<(intent: ActionIntent) => void>();
    const actionStateSource = new TestActionStateSource();
    const driver = createReactDOMRendererDriver({
      store,
      componentRegistry: registry,
      reactComponents: createStandardReactComponentRegistry(registry),
      onActionIntent,
      actionStateSource,
      enabledPackIds: ["default"],
      capabilities: [],
      packPriorities: { default: 1 },
      supportedPackVersions: { default: ["1.0.0"] },
    });
    const chatTarget = document.createElement("div");
    const workspaceTarget = document.createElement("div");
    document.body.append(chatTarget, workspaceTarget);

    let chatHandle: ReturnType<typeof driver.mount>;
    let workspaceHandle: ReturnType<typeof driver.mount>;
    await act(async () => {
      chatHandle = driver.mount(chatTarget, {
        surfaceId: "purchase",
        mode: "compact",
      });
      workspaceHandle = driver.mount(workspaceTarget, {
        surfaceId: "purchase",
        mode: "workspace",
      });
    });

    expect(
      chatTarget.querySelector("[data-surface-view='compact']"),
    ).not.toBeNull();
    expect(
      workspaceTarget.querySelector("[data-surface-view='workspace']"),
    ).not.toBeNull();
    expect(activeSubscriptions).toBe(2);
    expect(actionStateSource.activeSubscriptions).toBe(2);

    await act(async () => {
      store.updateData("purchase", 0, [{ path: "buyer", value: "Lin" }]);
    });
    expect((chatTarget.querySelector("input") as HTMLInputElement).value).toBe(
      "Lin",
    );
    expect(
      (workspaceTarget.querySelector("input") as HTMLInputElement).value,
    ).toBe("Lin");

    await act(async () => {
      chatHandle.update({ surfaceId: "teas", mode: "compact" });
    });
    expect(actionStateSource.activeSubscriptions).toBe(2);
    expect(actionStateSource.listeners.get("purchase")?.size).toBe(1);
    expect(actionStateSource.listeners.get("teas")?.size).toBe(1);
    expect(chatTarget.querySelector("[data-surface-id='teas']")).not.toBeNull();
    expect(
      (chatTarget.querySelector("button") as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      workspaceTarget.querySelector("[data-surface-id='purchase']"),
    ).not.toBeNull();
    fireEvent.click(chatTarget.querySelector("button") as HTMLButtonElement);
    expect(onActionIntent).toHaveBeenCalledWith({
      id: expect.stringMatching(/^teas:tea-cards:select:[0-9a-f]{32}$/),
      surfaceId: "teas",
      nodeId: "tea-cards",
      action: "select",
      input: { value: ["longjing"] },
    });

    await act(async () => {
      chatHandle.unmount();
      chatHandle.unmount();
      workspaceHandle.unmount();
      workspaceHandle.unmount();
    });
    expect(activeSubscriptions).toBe(0);
    expect(actionStateSource.activeSubscriptions).toBe(0);
    expect(chatTarget.childElementCount).toBe(0);
    expect(workspaceTarget.childElementCount).toBe(0);
  });

  it("ignores remote security fields on a view reference", async () => {
    const { registry, store } = createRuntime();
    const driver = createReactDOMRendererDriver({
      store,
      componentRegistry: registry,
      reactComponents: createStandardReactComponentRegistry(registry),
      enabledPackIds: ["default"],
    });
    const target = document.createElement("div");
    const remoteReference = {
      surfaceId: "purchase",
      mode: "compact" as const,
      enabledPackIds: ["remote-pack"],
      capabilities: ["remote-capability"],
    };

    let handle: ReturnType<typeof driver.mount>;
    await act(async () => {
      handle = driver.mount(target, remoteReference);
    });
    expect(target.querySelector("[data-surface-id='purchase']")).not.toBeNull();
    await act(async () => handle.unmount());
  });
});
