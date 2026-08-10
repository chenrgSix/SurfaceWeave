// @vitest-environment jsdom

import {
  InMemorySurfaceStore,
  componentManifestToDefinition,
  createStandardComponentRegistry,
  standardComponentManifests,
  type ActionIntent,
  type ComponentManifest,
} from "@surfaceweave/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SurfaceRenderer,
  createStandardReactComponentRegistry,
  safeLayoutItemStyle,
  safeLayoutStyle,
  type ReactComponentPack,
  type RendererComponentProps,
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
  it("maps portable layouts and safely degrades compact columns", () => {
    expect(
      safeLayoutStyle(
        {
          columns: 3,
          gap: 16,
          align: "end",
          justify: "between",
          modes: { compact: { gap: 8 } },
        },
        "workspace",
      ),
    ).toMatchObject({
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 16,
      alignItems: "flex-end",
      justifyContent: "space-between",
    });
    expect(
      safeLayoutStyle(
        { columns: 3, modes: { compact: { gap: 8 } } },
        "compact",
      ),
    ).toMatchObject({
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
      gap: 8,
    });
    expect(safeLayoutItemStyle({ span: 2, columns: 4 }, "workspace")).toEqual({
      gridColumn: "span 2",
    });
  });

  it("renders Section with container layout while applying span as item placement", () => {
    const registry = createStandardComponentRegistry();
    const store = new InMemorySurfaceStore(registry);
    store.createSurface({
      id: "layout-form",
      intent: "form",
      tree: {
        id: "form",
        component: "Form",
        props: { title: "Layout" },
        layout: { columns: 2, gap: 16 },
        children: [
          {
            id: "section",
            component: "Section",
            props: { title: "Delivery" },
            layout: { direction: "column", gap: 8, span: 2 },
            children: [
              {
                id: "address",
                component: "TextInput",
                props: { label: "Address" },
                binding: { path: "address", valueType: "string" },
              },
            ],
          },
        ],
      },
      data: { address: "" },
      context: {},
    });

    const view = render(
      <SurfaceRenderer
        store={store}
        componentRegistry={registry}
        reactComponents={createStandardReactComponentRegistry(registry)}
        surfaceId="layout-form"
      />,
    );

    expect(screen.getByRole("heading", { name: "Delivery" })).toBeTruthy();
    expect(
      view.container.querySelector("fieldset > div")?.getAttribute("style"),
    ).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(
      screen.getByRole("heading", { name: "Delivery" }).parentElement
        ?.parentElement?.style.gridColumn,
    ).toBe("span 2");
  });

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

  it("switches surface ids without rendering the previous snapshot", () => {
    const runtime = createFormRuntime();
    runtime.store.createSurface({
      id: "second",
      intent: "confirm",
      tree: {
        id: "confirm",
        component: "Confirm",
        props: { title: "Second surface", message: "Ready" },
      },
      data: {},
      context: {},
    });
    const view = render(
      <SurfaceRenderer
        store={runtime.store}
        componentRegistry={runtime.registry}
        reactComponents={runtime.reactComponents}
        surfaceId="purchase"
      />,
    );

    view.rerender(
      <SurfaceRenderer
        store={runtime.store}
        componentRegistry={runtime.registry}
        reactComponents={runtime.reactComponents}
        surfaceId="second"
      />,
    );

    expect(screen.getByText("Second surface")).toBeTruthy();
    expect(screen.queryByText("Purchase")).toBeNull();
  });

  it("uses an explicit pack allow-list and falls back without rewriting the Surface", async () => {
    const businessManifest: ComponentManifest = {
      semanticType: "BusinessTextInput",
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" } },
      },
      binding: { valueTypes: ["string"] },
      fallback: "TextInput",
    };
    const textInputManifest = standardComponentManifests.find(
      (component) => component.semanticType === "TextInput",
    );
    expect(textInputManifest).toBeDefined();
    const registry = createStandardComponentRegistry();
    registry.register(componentManifestToDefinition(businessManifest));
    const store = new InMemorySurfaceStore(registry);
    store.createSurface({
      id: "business",
      intent: "form",
      tree: {
        id: "business-name",
        stableId: "business.name",
        component: "BusinessTextInput",
        props: { label: "Business name" },
        binding: { path: "name", valueType: "string" },
      },
      data: { name: "Original" },
      context: {},
    });
    function BusinessInput({ value, onValueChange }: RendererComponentProps) {
      return (
        <input
          aria-label="Business name"
          data-binding="business"
          value={String(value ?? "")}
          onChange={(event) => onValueChange(event.currentTarget.value)}
        />
      );
    }
    function AlternateInput({ value, onValueChange }: RendererComponentProps) {
      return (
        <input
          aria-label="Business name"
          data-binding="alternate"
          value={String(value ?? "")}
          onChange={(event) => onValueChange(event.currentTarget.value)}
        />
      );
    }
    const businessPack: ReactComponentPack = {
      manifest: {
        protocolVersion: "1.0",
        id: "business",
        version: "1.0.0",
        rendererKind: "react",
        components: [businessManifest],
      },
      bindings: { BusinessTextInput: BusinessInput },
    };
    const alternatePack: ReactComponentPack = {
      manifest: {
        protocolVersion: "1.0",
        id: "alternate",
        version: "1.0.0",
        rendererKind: "react",
        components: [textInputManifest as ComponentManifest],
      },
      bindings: { TextInput: AlternateInput },
    };
    const reactComponents = createStandardReactComponentRegistry(registry);
    reactComponents.registerPack(businessPack);
    reactComponents.registerPack(alternatePack);
    const view = render(
      <SurfaceRenderer
        store={store}
        componentRegistry={registry}
        reactComponents={reactComponents}
        surfaceId="business"
        preferredPack="business"
        enabledPackIds={["business", "default"]}
      />,
    );
    expect(screen.getByRole("textbox").getAttribute("data-binding")).toBe(
      "business",
    );

    view.rerender(
      <SurfaceRenderer
        store={store}
        componentRegistry={registry}
        reactComponents={reactComponents}
        surfaceId="business"
        preferredPack="alternate"
        enabledPackIds={["alternate", "default"]}
      />,
    );
    const fallbackInput = screen.getByRole("textbox");
    expect(fallbackInput.getAttribute("data-binding")).toBe("alternate");
    expect(store.requireSurface("business").tree.component).toBe(
      "BusinessTextInput",
    );
    expect((fallbackInput as HTMLInputElement).value).toBe("Original");
    await userEvent.setup().type(fallbackInput, " value");
    expect(store.requireSurface("business").data).toEqual({
      name: "Original value",
    });
  });
});
