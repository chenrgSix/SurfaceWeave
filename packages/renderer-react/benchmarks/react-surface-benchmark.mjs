import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  recommendedSurfaceResourcePolicy,
  standardComponentManifests,
} from "@surfaceweave/core";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";

import { ReactComponentRegistry, SurfaceRenderer } from "../dist/index.js";
import {
  measureAsync,
  measureSync,
  printBenchmarkReport,
  readBenchmarkOptions,
  runtimeMetadata,
} from "../../../scripts/performance/benchmark-utils.mjs";
import { createFlatFormSurface } from "../../../scripts/performance/surface-fixtures.mjs";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Event = dom.window.Event;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderCounts = new Map();

function recordRender(nodeId) {
  renderCounts.set(nodeId, (renderCounts.get(nodeId) ?? 0) + 1);
}

function CountingForm({ node, children }) {
  recordRender(node.id);
  return createElement("form", { "data-node-id": node.id }, children);
}

function CountingInput({ node, value, onValueChange }) {
  recordRender(node.id);
  return createElement("input", {
    "aria-label": String(node.props.label ?? node.id),
    "data-node-id": node.id,
    value: typeof value === "string" ? value : "",
    onChange: (event) => onValueChange(event.currentTarget.value),
  });
}

function createCountingRegistry(registry) {
  const reactComponents = new ReactComponentRegistry(registry);
  const components = standardComponentManifests.filter(
    (component) =>
      component.semanticType === "Form" ||
      component.semanticType === "TextInput",
  );
  reactComponents.registerPack({
    manifest: {
      protocolVersion: "1.0",
      id: "performance",
      version: "1.0.0",
      rendererKind: "react",
      components,
    },
    bindings: {
      Form: CountingForm,
      TextInput: CountingInput,
    },
  });
  return reactComponents;
}

function renderCountSummary(surfaceId, nodeCount) {
  const targetId = `${surfaceId}.field0`;
  const siblingId = `${surfaceId}.field${Math.min(1, nodeCount - 2)}`;
  return {
    total: [...renderCounts.values()].reduce((sum, count) => sum + count, 0),
    root: renderCounts.get(`${surfaceId}.root`) ?? 0,
    target: renderCounts.get(targetId) ?? 0,
    sibling: renderCounts.get(siblingId) ?? 0,
    distinctNodes: renderCounts.size,
  };
}

async function benchmarkRender(nodeCount, smoke) {
  const registry = createStandardComponentRegistry();
  const reactComponents = createCountingRegistry(registry);
  const store = new InMemorySurfaceStore(registry, {
    resourcePolicy: recommendedSurfaceResourcePolicy,
  });
  const surfaceId = `react-${nodeCount}`;
  let surface = store.createSurface(
    createFlatFormSurface(nodeCount, surfaceId),
  );
  const renderer = createElement(SurfaceRenderer, {
    surfaceId,
    store,
    componentRegistry: registry,
    reactComponents,
  });
  const initialMount = await measureAsync(
    async () => {
      const mountTarget = document.createElement("div");
      document.body.append(mountTarget);
      const mountRoot = createRoot(mountTarget);
      await act(async () => mountRoot.render(renderer));
      await act(async () => mountRoot.unmount());
      mountTarget.remove();
    },
    {
      samples: smoke ? 1 : nodeCount >= 2_000 ? 5 : 10,
      warmups: smoke ? 0 : 1,
    },
  );
  const target = document.createElement("div");
  document.body.append(target);
  const root = createRoot(target);
  await act(async () => {
    root.render(renderer);
  });

  renderCounts.clear();
  let valueSequence = 0;
  await act(async () => {
    valueSequence += 1;
    surface = store.updateData(surfaceId, surface.revision, [
      { path: "fields.field0", value: `count-${valueSequence}` },
    ]);
  });
  const counts = renderCountSummary(surfaceId, nodeCount);

  renderCounts.clear();
  const timing = await measureAsync(
    async () => {
      await act(async () => {
        valueSequence += 1;
        surface = store.updateData(surfaceId, surface.revision, [
          { path: "fields.field0", value: `timing-${valueSequence}` },
        ]);
      });
    },
    {
      samples: smoke ? 2 : nodeCount >= 2_000 ? 8 : 15,
      warmups: smoke ? 1 : 2,
    },
  );

  await act(async () => root.unmount());
  target.remove();
  store.dispose();
  return { initialMount, timing, counts };
}

const options = readBenchmarkOptions();
const sizes = options.sizes ?? (options.smoke ? [50] : [50, 500, 2_000]);
const scenarios = [];
for (const nodeCount of sizes) {
  const result = await benchmarkRender(nodeCount, options.smoke);
  scenarios.push({
    name: `react-jsdom-${nodeCount}`,
    metrics: {
      initialMountAndUnmount: result.initialMount,
      updateAndCommit: result.timing,
    },
    renderCounts: result.counts,
  });
}

const resolutionRegistry = createStandardComponentRegistry();
const resolutionComponents = createCountingRegistry(resolutionRegistry);
scenarios.push({
  name: "component-resolution",
  metrics: {
    resolveTextInput: measureSync(
      () => resolutionComponents.resolve("TextInput"),
      {
        samples: options.smoke ? 2 : 20,
        warmups: 3,
        operationsPerSample: options.smoke ? 5 : 100,
      },
    ),
  },
});

printBenchmarkReport(
  {
    name: "SurfaceWeave React jsdom benchmark",
    runtime: runtimeMetadata(),
    scenarios,
  },
  options,
);

dom.window.close();
