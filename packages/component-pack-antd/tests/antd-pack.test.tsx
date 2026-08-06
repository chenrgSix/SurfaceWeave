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
import { theme } from "antd";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  antDesignComponentPackManifest,
  createAntDesignComponentPack,
} from "../src/index.js";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(cleanup);

function createRuntime() {
  const components = createStandardComponentRegistry();
  const store = new InMemorySurfaceStore(components);
  store.createSurface({
    id: "antd-form",
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
          id: "gift",
          stableId: "purchase.gift",
          component: "Checkbox",
          props: { label: "Gift wrap" },
          binding: { path: "gift", valueType: "boolean" },
        },
        {
          id: "continue",
          component: "Action",
          props: { label: "Continue" },
        },
      ],
    },
    data: { buyer: "", gift: false },
    context: {},
  });
  const reactComponents = createStandardReactComponentRegistry(components);
  const pack = createAntDesignComponentPack({
    theme: { token: { colorPrimary: "#123456" } },
  });
  reactComponents.registerPack(pack);
  return { components, store, reactComponents, pack };
}

describe("Ant Design Component Pack", () => {
  it("has a serializable manifest and complete React bindings", () => {
    const components = createStandardComponentRegistry();
    const pack = createAntDesignComponentPack();

    expect(validateReactComponentPack(pack, components)).toEqual({
      valid: true,
      errors: [],
    });
    expect(JSON.parse(JSON.stringify(antDesignComponentPackManifest))).toEqual(
      antDesignComponentPackManifest,
    );
    expect(JSON.stringify(antDesignComponentPackManifest)).not.toMatch(
      /ReactNode|className|onChange|JSX|ConfigProvider/,
    );
  });

  it("selects the Ant Design binding only for compatible React hosts", () => {
    const runtime = createRuntime();
    const selected = runtime.reactComponents.resolve("TextInput", {
      preferredPack: "antd",
      capabilities: ["web"],
    }).resolution;
    expect(selected.packId).toBe("antd");
    expect(selected.rendererKind).toBe("react");

    const fallback = runtime.reactComponents.resolve("TextInput", {
      preferredPack: "antd",
    }).resolution;
    expect(fallback.packId).toBe("default");
  });

  it("applies host theme tokens without putting them in the manifest", () => {
    const pack = createAntDesignComponentPack({
      theme: { token: { colorPrimary: "#123456" } },
    });
    const Provider = pack.Provider;
    expect(Provider).toBeDefined();

    function ThemeProbe() {
      const { token } = theme.useToken();
      return <output>{token.colorPrimary}</output>;
    }

    render(
      Provider === undefined ? null : (
        <Provider>
          <ThemeProbe />
        </Provider>
      ),
    );
    expect(screen.getByText("#123456")).toBeTruthy();
  });

  it("synchronizes bindings and emits only semantic ActionIntent values", async () => {
    const runtime = createRuntime();
    const intents: ActionIntent[] = [];
    const user = userEvent.setup();
    render(
      <SurfaceRenderer
        surfaceId="antd-form"
        store={runtime.store}
        componentRegistry={runtime.components}
        reactComponents={runtime.reactComponents}
        preferredPack="antd"
        capabilities={["web"]}
        onActionIntent={(intent) => intents.push(intent)}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Buyer" }), "Lin");
    await user.click(screen.getByRole("checkbox", { name: "Gift wrap" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(runtime.store.requireSurface("antd-form").data).toEqual({
      buyer: "Lin",
      gift: true,
    });
    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual(
      expect.objectContaining({ action: "press", input: null }),
    );
    expect(JSON.stringify(intents[0])).not.toMatch(/function|script|onClick/);
  });
});
