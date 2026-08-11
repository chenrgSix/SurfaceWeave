// @vitest-environment jsdom

import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  standardComponentManifests,
} from "@surfaceweave/core";
import type { SurfaceStore } from "@surfaceweave/core";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReactComponentRegistry, SurfaceRenderer } from "../src/index.js";
import type { RendererComponentProps } from "../src/index.js";

const renderCounts = new Map<string, number>();

function record(nodeId: string): void {
  renderCounts.set(nodeId, (renderCounts.get(nodeId) ?? 0) + 1);
}

function CountingForm({ node, children }: RendererComponentProps) {
  record(node.id);
  return <form>{children}</form>;
}

function CountingInput({ node, value }: RendererComponentProps) {
  record(node.id);
  return <input aria-label={node.id} readOnly value={String(value ?? "")} />;
}

function createRuntime() {
  const components = createStandardComponentRegistry();
  const store = new InMemorySurfaceStore(components);
  store.createSurface({
    id: "render-counts",
    intent: "form",
    tree: {
      id: "root",
      component: "Form",
      props: {},
      children: [
        {
          id: "target",
          component: "TextInput",
          props: { label: "Target" },
          binding: { path: "fields.target", valueType: "string" },
        },
        {
          id: "sibling",
          component: "TextInput",
          props: { label: "Sibling" },
          binding: { path: "fields.sibling", valueType: "string" },
        },
      ],
    },
    data: { fields: { target: "before", sibling: "stable" } },
    context: {},
  });
  const reactComponents = new ReactComponentRegistry(components);
  reactComponents.registerPack({
    manifest: {
      protocolVersion: "1.0",
      id: "counting",
      version: "1.0.0",
      rendererKind: "react",
      components: standardComponentManifests.filter(
        (component) =>
          component.semanticType === "Form" ||
          component.semanticType === "TextInput",
      ),
    },
    bindings: { Form: CountingForm, TextInput: CountingInput },
  });
  return { components, store, reactComponents };
}

function legacyStore(store: InMemorySurfaceStore): {
  store: SurfaceStore;
  subscribe: ReturnType<typeof vi.fn>;
} {
  const subscribe = vi.fn(store.subscribe.bind(store));
  return {
    subscribe,
    store: {
      createSurface: store.createSurface.bind(store),
      getSurface: store.getSurface.bind(store),
      requireSurface: store.requireSurface.bind(store),
      subscribe,
      applyOperations: store.applyOperations.bind(store),
      updateData: store.updateData.bind(store),
      replaceSurface: store.replaceSurface.bind(store),
    },
  };
}

afterEach(() => {
  cleanup();
  renderCounts.clear();
});

describe("SurfaceRenderer read model", () => {
  it("renders only the bound target in each mounted view", () => {
    const runtime = createRuntime();
    render(
      <>
        <SurfaceRenderer
          surfaceId="render-counts"
          store={runtime.store}
          componentRegistry={runtime.components}
          reactComponents={runtime.reactComponents}
        />
        <SurfaceRenderer
          surfaceId="render-counts"
          store={runtime.store}
          componentRegistry={runtime.components}
          reactComponents={runtime.reactComponents}
        />
      </>,
    );
    renderCounts.clear();

    act(() => {
      runtime.store.updateData("render-counts", 0, [
        { path: "fields.target", value: "after" },
      ]);
    });

    expect(renderCounts.get("target")).toBe(2);
    expect(renderCounts.get("sibling") ?? 0).toBe(0);
    expect(renderCounts.get("root") ?? 0).toBe(0);
  });

  it("falls back to the unchanged SurfaceStore subscription contract", () => {
    const runtime = createRuntime();
    const legacy = legacyStore(runtime.store);
    render(
      <SurfaceRenderer
        surfaceId="render-counts"
        store={legacy.store}
        componentRegistry={runtime.components}
        reactComponents={runtime.reactComponents}
      />,
    );
    renderCounts.clear();

    act(() => {
      legacy.store.updateData("render-counts", 0, [
        { path: "fields.target", value: "after" },
      ]);
    });

    expect(legacy.subscribe).toHaveBeenCalledOnce();
    expect(renderCounts.get("target")).toBe(1);
    expect(renderCounts.get("sibling") ?? 0).toBe(0);
    expect(renderCounts.get("root") ?? 0).toBe(0);
  });

  it("refreshes the normalized tree after a structural event", () => {
    const runtime = createRuntime();
    render(
      <SurfaceRenderer
        surfaceId="render-counts"
        store={runtime.store}
        componentRegistry={runtime.components}
        reactComponents={runtime.reactComponents}
      />,
    );
    renderCounts.clear();

    act(() => {
      runtime.store.applyOperations("render-counts", 0, [
        {
          type: "setVisibility",
          target: "sibling",
          visible: false,
        },
      ]);
    });

    expect(renderCounts.get("root")).toBe(1);
    expect(renderCounts.get("target")).toBe(1);
    expect(renderCounts.get("sibling") ?? 0).toBe(0);
  });
});
