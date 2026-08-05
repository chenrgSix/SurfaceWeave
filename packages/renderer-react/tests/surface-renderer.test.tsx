// @vitest-environment jsdom

import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  type ActionIntent,
} from "@package-first/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SurfaceRenderer,
  createStandardReactComponentRegistry,
} from "../src/index.js";

afterEach(cleanup);

function createFormRuntime() {
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
          stableId: "purchase.buyer",
          component: "TextInput",
          props: { label: "Buyer" },
          binding: { path: "buyer", valueType: "string" },
        },
      ],
    },
    data: { buyer: "Ada" },
    context: {},
  });
  return {
    registry,
    store,
    reactComponents: createStandardReactComponentRegistry(registry),
  };
}

describe("SurfaceRenderer", () => {
  it("keeps compact chat and full workspace views on the same Store state", async () => {
    const runtime = createFormRuntime();
    const user = userEvent.setup();
    render(
      <>
        <SurfaceRenderer
          store={runtime.store}
          reactComponents={runtime.reactComponents}
          componentRegistry={runtime.registry}
          surfaceId="purchase"
          mode="compact"
        />
        <SurfaceRenderer
          store={runtime.store}
          reactComponents={runtime.reactComponents}
          componentRegistry={runtime.registry}
          surfaceId="purchase"
          mode="workspace"
        />
      </>,
    );
    const inputs = screen.getAllByLabelText("Buyer") as HTMLInputElement[];

    await user.clear(inputs[0] as HTMLInputElement);
    await user.type(inputs[0] as HTMLInputElement, "Lin");

    expect(inputs[0]?.value).toBe("Lin");
    expect(inputs[1]?.value).toBe("Lin");
    expect(runtime.store.requireSurface("purchase").data).toEqual({
      buyer: "Lin",
    });
  });

  it("emits a validated ActionIntent without calling a network", () => {
    const registry = createStandardComponentRegistry();
    const store = new InMemorySurfaceStore(registry);
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
    const onActionIntent = vi.fn<(intent: ActionIntent) => void>();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <SurfaceRenderer
        store={store}
        componentRegistry={registry}
        reactComponents={createStandardReactComponentRegistry(registry)}
        surfaceId="teas"
        onActionIntent={onActionIntent}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Longjing" }));

    expect(onActionIntent).toHaveBeenCalledWith({
      id: "teas:tea-cards:select:1",
      surfaceId: "teas",
      nodeId: "tea-cards",
      action: "select",
      input: { value: ["longjing"] },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("renders a field as collapsed after a semantic props operation", () => {
    const runtime = createFormRuntime();
    runtime.store.applyOperations("purchase", 0, [
      {
        type: "setProps",
        target: "purchase.buyer",
        props: { collapsed: true },
      },
    ]);
    render(
      <SurfaceRenderer
        store={runtime.store}
        componentRegistry={runtime.registry}
        reactComponents={runtime.reactComponents}
        surfaceId="purchase"
      />,
    );

    expect(
      screen.getByText("Buyer", { selector: "summary" }).closest("details")
        ?.open,
    ).toBe(false);
  });
});
