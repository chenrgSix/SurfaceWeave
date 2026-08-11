import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  standardComponentManifests,
} from "@surfaceweave/core";
import type { Surface } from "@surfaceweave/core";
import { ReactComponentRegistry, SurfaceRenderer } from "@surfaceweave/react";
import type { RendererComponentProps } from "@surfaceweave/react";
import { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

interface CommitResult {
  durationMs: number;
  renders: Record<string, number>;
}

export interface BrowserBenchmarkApi {
  mount(nodeCount: number): Promise<CommitResult>;
  update(fieldIndex?: number): Promise<CommitResult>;
  unmount(): void;
}

declare global {
  interface Window {
    surfaceweavePerformance: BrowserBenchmarkApi;
  }
}

const renderCounts = new Map<string, number>();
let pendingCommit:
  | { nodeId: string; startedAt: number; resolve(result: CommitResult): void }
  | undefined;

function renderSummary(): Record<string, number> {
  return Object.fromEntries(renderCounts);
}

function recordRender(nodeId: string): void {
  renderCounts.set(nodeId, (renderCounts.get(nodeId) ?? 0) + 1);
}

function signalCommit(nodeId: string): void {
  if (pendingCommit?.nodeId !== nodeId) return;
  const commit = pendingCommit;
  pendingCommit = undefined;
  commit.resolve({
    durationMs: performance.now() - commit.startedAt,
    renders: renderSummary(),
  });
}

function CountingForm({ node, children }: RendererComponentProps) {
  recordRender(node.id);
  useLayoutEffect(() => signalCommit(node.id));
  return <form>{children}</form>;
}

function CountingInput({ node, value }: RendererComponentProps) {
  recordRender(node.id);
  useLayoutEffect(() => signalCommit(node.id));
  return <input aria-label={node.id} readOnly value={String(value ?? "")} />;
}

function createSurface(nodeCount: number): Omit<Surface, "revision"> {
  const fields: Record<string, string> = {};
  const children: NonNullable<Surface["tree"]["children"]> = [];
  for (let index = 0; index < nodeCount - 1; index += 1) {
    const field = `field${index}`;
    fields[field] = "value";
    children.push({
      id: field,
      component: "TextInput",
      props: { label: `Field ${index}` },
      binding: { path: `fields.${field}`, valueType: "string" },
    });
  }
  return {
    id: `browser-${nodeCount}`,
    intent: "form",
    tree: {
      id: "root",
      component: "Form",
      props: { title: `Browser ${nodeCount}` },
      children,
    },
    data: { fields },
    context: { source: "browser-performance" },
  };
}

function nextCommit(nodeId: string): Promise<CommitResult> {
  renderCounts.clear();
  return new Promise((resolve) => {
    pendingCommit = { nodeId, startedAt: performance.now(), resolve };
  });
}

let active:
  | {
      root: Root;
      store: InMemorySurfaceStore;
      surfaceId: string;
      revision: number;
      valueSequence: number;
    }
  | undefined;

function unmount(): void {
  pendingCommit = undefined;
  active?.root.unmount();
  active?.store.dispose();
  active = undefined;
}

async function mount(nodeCount: number): Promise<CommitResult> {
  unmount();
  const components = createStandardComponentRegistry();
  const store = new InMemorySurfaceStore(components);
  const surface = store.createSurface(createSurface(nodeCount));
  const reactComponents = new ReactComponentRegistry(components);
  reactComponents.registerPack({
    manifest: {
      protocolVersion: "1.0",
      id: "browser-performance",
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
  const target = document.querySelector("#root");
  if (!(target instanceof HTMLElement)) throw new Error("Missing root element");
  const root = createRoot(target);
  active = {
    root,
    store,
    surfaceId: surface.id,
    revision: surface.revision,
    valueSequence: 0,
  };
  const committed = nextCommit("root");
  root.render(
    <SurfaceRenderer
      surfaceId={surface.id}
      store={store}
      componentRegistry={components}
      reactComponents={reactComponents}
    />,
  );
  return committed;
}

async function update(fieldIndex = 0): Promise<CommitResult> {
  if (active === undefined) throw new Error("Mount the benchmark first");
  active.valueSequence += 1;
  const field = `field${fieldIndex}`;
  const committed = nextCommit(field);
  const updated = active.store.updateData(active.surfaceId, active.revision, [
    { path: `fields.${field}`, value: `value-${active.valueSequence}` },
  ]);
  active.revision = updated.revision;
  return committed;
}

window.surfaceweavePerformance = { mount, update, unmount };
