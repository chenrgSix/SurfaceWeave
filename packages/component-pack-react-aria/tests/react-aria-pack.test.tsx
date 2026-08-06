// @vitest-environment jsdom

import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
} from "@package-first/core";
import type { ActionIntent } from "@package-first/core";
import {
  SurfaceRenderer,
  createStandardReactComponentRegistry,
  validateReactComponentPack,
} from "@package-first/renderer-react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createReactAriaComponentPack,
  reactAriaComponentPackManifest,
} from "../src/index.js";

afterEach(cleanup);

function createRuntime() {
  const components = createStandardComponentRegistry();
  const store = new InMemorySurfaceStore(components);
  store.createSurface({
    id: "aria-form",
    intent: "form",
    tree: {
      id: "form",
      component: "Form",
      props: { title: "Tea order", submitLabel: "Submit order" },
      children: [
        {
          id: "buyer",
          stableId: "purchase.buyer",
          component: "TextInput",
          props: { label: "Buyer" },
          binding: { path: "buyer", valueType: "string" },
        },
        {
          id: "quantity",
          stableId: "purchase.quantity",
          component: "NumberInput",
          props: { label: "Quantity", minimum: 1 },
          binding: { path: "quantity", valueType: "number" },
        },
        {
          id: "tea-type",
          stableId: "purchase.teaType",
          component: "ChoiceField",
          props: {
            label: "Tea type",
            options: [
              { id: "green", name: "Green tea" },
              { id: "oolong", name: "Oolong tea" },
            ],
            multiple: false,
          },
          binding: {
            path: "teaType",
            valueType: "string",
            semantic: "selection",
          },
        },
        {
          id: "tags",
          stableId: "purchase.tags",
          component: "ChoiceField",
          props: {
            label: "Tags",
            options: ["Gift", "Organic"],
            multiple: true,
          },
          binding: {
            path: "tags",
            valueType: "array",
            semantic: "selection",
          },
        },
      ],
    },
    data: { buyer: "", quantity: 1, teaType: "", tags: [] },
    context: {},
  });
  const reactComponents = createStandardReactComponentRegistry(components);
  const pack = createReactAriaComponentPack({ locale: "en-US" });
  reactComponents.registerPack(pack);
  return { components, store, reactComponents, pack };
}

describe("React Aria Component Pack", () => {
  it("has a serializable manifest and complete React bindings", () => {
    const components = createStandardComponentRegistry();
    const pack = createReactAriaComponentPack();

    expect(validateReactComponentPack(pack, components)).toEqual({
      valid: true,
      errors: [],
    });
    expect(JSON.parse(JSON.stringify(reactAriaComponentPackManifest))).toEqual(
      reactAriaComponentPackManifest,
    );
    expect(JSON.stringify(reactAriaComponentPackManifest)).not.toMatch(
      /ReactNode|className|onChange|JSX/,
    );
  });

  it("selects only when renderer kind and capabilities are compatible", () => {
    const runtime = createRuntime();

    expect(
      runtime.reactComponents.resolve("TextInput", {
        preferredPack: "react-aria",
        capabilities: ["web"],
      }).resolution.packId,
    ).toBe("react-aria");
    const fallback = runtime.reactComponents.resolve("TextInput", {
      preferredPack: "react-aria",
    }).resolution;
    expect(fallback.packId).toBe("default");
    expect(fallback.diagnostics).toContainEqual(
      expect.objectContaining({ code: "PREFERRED_PACK_UNAVAILABLE" }),
    );
  });

  it("preserves labels, keyboard focus, bindings, and ActionIntent behavior", async () => {
    const runtime = createRuntime();
    const user = userEvent.setup();
    const intents: ActionIntent[] = [];
    render(
      <SurfaceRenderer
        surfaceId="aria-form"
        store={runtime.store}
        componentRegistry={runtime.components}
        reactComponents={runtime.reactComponents}
        preferredPack="react-aria"
        capabilities={["web"]}
        onActionIntent={(intent) => intents.push(intent)}
      />,
    );

    const buyer = screen.getByRole("textbox", { name: "Buyer" });
    await user.tab();
    expect(document.activeElement).toBe(buyer);
    await user.type(buyer, "Lin");
    await user.click(screen.getByRole("radio", { name: "Green tea" }));
    await user.click(screen.getByRole("checkbox", { name: "Gift" }));

    expect(runtime.store.requireSurface("aria-form").data).toEqual({
      buyer: "Lin",
      quantity: 1,
      teaType: "green",
      tags: ["Gift"],
    });
    expect(intents.map((intent) => intent.action)).toEqual([
      "select",
      "select",
    ]);
    expect(
      screen
        .getByRole("textbox", { name: "Quantity" })
        .getAttribute("inputmode"),
    ).toBe("numeric");
  });

  it("uses React Aria dialog focus management and semantic actions", async () => {
    const components = createStandardComponentRegistry();
    const store = new InMemorySurfaceStore(components);
    store.createSurface({
      id: "confirm",
      intent: "confirm",
      tree: {
        id: "dialog",
        component: "Dialog",
        props: { title: "Confirm purchase", message: "Proceed?" },
      },
      data: {},
      context: {},
    });
    const reactComponents = createStandardReactComponentRegistry(components);
    reactComponents.registerPack(createReactAriaComponentPack());
    const onIntent = vi.fn<(intent: ActionIntent) => void>();
    const user = userEvent.setup();
    render(
      <SurfaceRenderer
        surfaceId="confirm"
        store={store}
        componentRegistry={components}
        reactComponents={reactComponents}
        preferredPack="react-aria"
        capabilities={["web"]}
        onActionIntent={onIntent}
      />,
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Confirm purchase",
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onIntent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "confirm", input: null }),
    );
  });
});
