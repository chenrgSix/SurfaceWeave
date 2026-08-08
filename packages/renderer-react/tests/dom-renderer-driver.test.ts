// @vitest-environment jsdom

import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  type ActionIntent,
  type SurfaceListener,
} from "@surfaceweave/core";
import { fireEvent } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { createReactDOMRendererDriver } from "../src/dom.js";
import { createStandardReactComponentRegistry } from "../src/index.js";

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
  it("mounts shared views, updates references, forwards actions, and cleans subscriptions", async () => {
    const { registry, store } = createRuntime();
    const originalSubscribe = store.subscribe.bind(store);
    let activeSubscriptions = 0;
    vi.spyOn(store, "subscribe").mockImplementation(
      (surfaceId: string, listener: SurfaceListener) => {
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
    const driver = createReactDOMRendererDriver({
      store,
      componentRegistry: registry,
      reactComponents: createStandardReactComponentRegistry(registry),
      onActionIntent,
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
    expect(chatTarget.querySelector("[data-surface-id='teas']")).not.toBeNull();
    expect(
      workspaceTarget.querySelector("[data-surface-id='purchase']"),
    ).not.toBeNull();
    fireEvent.click(chatTarget.querySelector("button") as HTMLButtonElement);
    expect(onActionIntent).toHaveBeenCalledWith({
      id: "teas:tea-cards:select:1",
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
