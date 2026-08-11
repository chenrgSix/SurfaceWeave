import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import {
  npmRegistry,
  releasePackages,
  releaseVersion,
} from "./release-packages.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "surfaceweave-consumers-"));
const tarballDirectory = join(fixtureRoot, "tarballs");
mkdirSync(tarballDirectory);
const { values } = parseArgs({
  args: process.argv.slice(2).filter((value, index) => {
    return index !== 0 || value !== "--";
  }),
  options: {
    fixture: { type: "string" },
    keep: { type: "boolean", default: false },
    published: { type: "boolean", default: false },
    tag: { type: "string", default: "next" },
  },
});

function run(command, arguments_, cwd, capture = false) {
  return execFileSync(command, arguments_, {
    cwd,
    encoding: capture ? "utf8" : undefined,
    env: {
      ...process.env,
      CI: "true",
      npm_config_cache: join(fixtureRoot, "npm-cache"),
      npm_config_registry: npmRegistry,
      npm_config_userconfig: "/dev/null",
    },
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function packPackages() {
  const tarballs = new Map();
  for (const releasePackage of releasePackages) {
    const directory = join(repositoryRoot, releasePackage.directory);
    const output = run(
      "npm",
      ["pack", "--json", "--pack-destination", tarballDirectory],
      directory,
      true,
    );
    const [result] = JSON.parse(output);
    const tarball = join(tarballDirectory, result.filename);
    if (!existsSync(tarball)) {
      throw new Error(`npm pack produced no tarball for ${result.name}`);
    }
    const packedManifest = JSON.parse(
      run("tar", ["-xOf", tarball, "package/package.json"], directory, true),
    );
    const packedLicense = run(
      "tar",
      ["-xOf", tarball, "package/LICENSE"],
      directory,
      true,
    );
    const rootLicense = readFileSync(
      resolve(repositoryRoot, "LICENSE"),
      "utf8",
    );
    if (packedLicense !== rootLicense) {
      throw new Error(`${result.name} tarball has no canonical MIT LICENSE`);
    }
    for (const [name, range] of Object.entries(
      packedManifest.dependencies ?? {},
    )) {
      if (String(range).startsWith("workspace:")) {
        throw new Error(`${result.name} packed ${name} as ${range}`);
      }
    }
    tarballs.set(result.name, tarball);
  }
  return tarballs;
}

const commonCompilerOptions = {
  strict: true,
  noEmit: true,
  module: "NodeNext",
  moduleResolution: "NodeNext",
  target: "ES2022",
  jsx: "react-jsx",
  // Ant Design's transitive rc-component declarations currently fail under
  // TypeScript 6 strict library checking; consumer API usage remains checked.
  skipLibCheck: true,
};

function verifyFixture(packageSpecs, fixture) {
  const directory = join(fixtureRoot, fixture.name);
  mkdirSync(directory);
  const dependencies = Object.fromEntries(
    fixture.packages.map((name) => [name, packageSpecs.get(name)]),
  );
  Object.assign(dependencies, fixture.dependencies ?? {});
  writeJson(join(directory, "package.json"), {
    name: `surfaceweave-${fixture.name}`,
    private: true,
    type: "module",
    dependencies,
  });
  writeJson(join(directory, "tsconfig.json"), {
    compilerOptions: commonCompilerOptions,
    include: ["consumer.ts"],
  });
  writeFileSync(join(directory, "consumer.ts"), fixture.consumer);
  for (const [relativePath, contents] of Object.entries(fixture.files ?? {})) {
    const destination = resolve(directory, relativePath);
    if (!destination.startsWith(`${directory}/`)) {
      throw new Error(`${fixture.name}: fixture file escapes its directory`);
    }
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  }
  const smoke =
    values.published && fixture.publishedSmoke !== undefined
      ? fixture.publishedSmoke
      : fixture.smoke;
  if (smoke !== undefined) {
    writeFileSync(join(directory, "smoke.mjs"), smoke);
  }
  if (fixture.viteEntry !== undefined) {
    writeFileSync(
      join(directory, "index.html"),
      '<div id="app"></div><script type="module" src="/main.js"></script>\n',
    );
    writeFileSync(join(directory, "main.js"), fixture.viteEntry);
  }

  run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    directory,
  );
  if (values.published) {
    const lockText = readFileSync(join(directory, "package-lock.json"), "utf8");
    if (
      lockText.includes("file:") ||
      lockText.includes("link:") ||
      lockText.includes(repositoryRoot)
    ) {
      throw new Error(
        `${fixture.name}: Registry consumer contains a local reference`,
      );
    }
    const lock = JSON.parse(lockText);
    for (const item of Object.values(lock.packages ?? {})) {
      if (
        typeof item.resolved === "string" &&
        !item.resolved.startsWith(npmRegistry)
      ) {
        throw new Error(
          `${fixture.name}: dependency resolved outside the official npm Registry`,
        );
      }
    }
  }
  const installedScope = join(directory, "node_modules", "@surfaceweave");
  const installed = existsSync(installedScope)
    ? readdirSync(installedScope).sort()
    : [];
  const expected = fixture.packages
    .map((name) => name.replace("@surfaceweave/", ""))
    .sort();
  if (JSON.stringify(installed) !== JSON.stringify(expected)) {
    throw new Error(
      `${fixture.name}: installed SurfaceWeave packages ${installed.join(", ")}; expected ${expected.join(", ")}`,
    );
  }
  run("npm", ["exec", "tsc", "--", "-p", "tsconfig.json"], directory);
  if (smoke !== undefined) run("node", ["smoke.mjs"], directory);
  if (fixture.vitest === true) {
    run("npm", ["exec", "vitest", "--", "run"], directory);
  }
  if (fixture.viteEntry !== undefined || fixture.viteBuild === true) {
    run("npm", ["exec", "vite", "--", "build"], directory);
  }
  process.stdout.write(
    `consumer:${values.published ? "registry" : "tarball"}:${fixture.name}:passed\n`,
  );
}

const typescript = { typescript: "6.0.2" };
const reactWithoutDOM = {
  ...typescript,
  react: "19.2.8",
  "@types/react": "19.2.18",
};
const react = {
  ...reactWithoutDOM,
  "react-dom": "19.2.8",
  "@types/react-dom": "19.2.4",
  vite: "8.2.0",
};
const vueAgentdown = {
  ...react,
  agentdown: "0.0.5",
  vue: "3.5.31",
  "@vue/compiler-sfc": "3.5.31",
  "@vitejs/plugin-vue": "6.0.5",
  vitest: "4.1.10",
  jsdom: "30.0.1",
};

const fixtures = [
  {
    name: "protocol",
    packages: ["@surfaceweave/protocol"],
    dependencies: typescript,
    consumer: `import schema from "@surfaceweave/protocol/schema" with { type: "json" };
import layoutSchema from "@surfaceweave/protocol/layout-schema" with { type: "json" };
import capabilitySchema from "@surfaceweave/protocol/client-capabilities-schema" with { type: "json" };
const dialect: string = schema.$schema;
const layoutId: string = layoutSchema.$id;
const capabilityId: string = capabilitySchema.$id;
void [dialect, layoutId, capabilityId];
`,
    smoke: `import schema from "@surfaceweave/protocol/schema" with { type: "json" };
import layoutSchema from "@surfaceweave/protocol/layout-schema" with { type: "json" };
import capabilitySchema from "@surfaceweave/protocol/client-capabilities-schema" with { type: "json" };
if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") throw new Error("protocol");
if (layoutSchema.$id !== "urn:surfaceweave:schema:semantic-layout:1.0") throw new Error("layout protocol");
if (capabilitySchema.$id !== "urn:surfaceweave:schema:surface-client-capabilities:1.0") throw new Error("capability protocol");
`,
  },
  {
    name: "core-only",
    packages: ["@surfaceweave/core"],
    dependencies: typescript,
    consumer: `import { InMemoryActionExecutionController, InMemorySurfaceStore, createStandardComponentRegistry, createSurfaceClientCapabilities, recommendedSurfaceResourcePolicy, resolveSemanticLayout } from "@surfaceweave/core";
import type { ActionExecutionStateSource, ActionIntent, SemanticLayout, SemanticLayoutFeature, Surface, SurfaceClientCapabilities, SurfaceResourcePolicy, ToolDefinition, UINode } from "@surfaceweave/core";
const layout: SemanticLayout = { columns: 2, modes: { compact: { columns: 1 } } };
const layoutFeatures: SemanticLayoutFeature[] = ["columns", "gap"];
const resolved = resolveSemanticLayout(layout, "compact", layoutFeatures);
const node: UINode = { id: "root", component: "Stack", props: {} };
const surface: Surface = { id: "surface", revision: 0, intent: "form", tree: node, data: {}, context: {} };
const policy: SurfaceResourcePolicy = recommendedSurfaceResourcePolicy;
const capabilities: SurfaceClientCapabilities = createSurfaceClientCapabilities(createStandardComponentRegistry(), { rendererKind: "fake", enabledPackIds: [], resourcePolicy: { enabled: true, limits: policy } });
const controller = new InMemoryActionExecutionController({ execute: async (intent) => ({ intentId: intent.id, status: "success" }) });
const actionSource: ActionExecutionStateSource = controller;
void [capabilities, actionSource];
const tool: ToolDefinition = { id: "tea.search", version: "1.0.0", inputSchema: { type: "object" } };
const intent: ActionIntent = { id: "intent", surfaceId: surface.id, nodeId: node.id, action: "submit", input: null };
const store = new InMemorySurfaceStore(createStandardComponentRegistry());
void [tool, intent, store, resolved];
`,
    smoke: `import { InMemorySurfaceStore, createStandardComponentRegistry } from "@surfaceweave/core";
const registry = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(registry);
if (store.getSurface("missing") !== undefined) throw new Error("core");
try {
  await import("@surfaceweave/core/types");
  throw new Error("internal Core subpath was exported");
} catch (error) {
  if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
}
`,
  },
  {
    name: "react-root-without-dom",
    packages: ["@surfaceweave/core", "@surfaceweave/react"],
    dependencies: reactWithoutDOM,
    consumer: `import { createStandardComponentRegistry } from "@surfaceweave/core";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
const components = createStandardComponentRegistry();
const renderer = createStandardReactComponentRegistry(components);
void renderer;
`,
    smoke: `const renderer = await import("@surfaceweave/react");
if (typeof renderer.SurfaceRenderer !== "function") throw new Error("React root entry");
try {
  await import("react-dom");
  throw new Error("react-dom was installed for the React root entry");
} catch (error) {
  if (error?.message === "react-dom was installed for the React root entry") throw error;
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
}
`,
  },
  {
    name: "react-default",
    packages: ["@surfaceweave/core", "@surfaceweave/react"],
    dependencies: react,
    consumer: `import { createStandardComponentRegistry } from "@surfaceweave/core";
import { createDefaultReactComponentPack, createStandardReactComponentRegistry, safeLayoutItemStyle, safeLayoutStyle } from "@surfaceweave/react";
import type { ReactComponentPack, RendererComponentProps, SurfaceRendererProps } from "@surfaceweave/react";
const registry = createStandardComponentRegistry();
const pack: ReactComponentPack = createDefaultReactComponentPack();
const renderer = createStandardReactComponentRegistry(registry);
const props = {} as SurfaceRendererProps;
const containerStyle = safeLayoutStyle({ columns: 2 }, "workspace");
const itemStyle = safeLayoutItemStyle({ span: 2 }, "workspace");
const componentProps = {} as RendererComponentProps;
void [pack, renderer, props, componentProps.actionStates, componentProps.interactionDisabled, containerStyle, itemStyle];
`,
    viteEntry: `import { createStandardComponentRegistry } from "@surfaceweave/core";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
const runtime = createStandardReactComponentRegistry(createStandardComponentRegistry());
document.querySelector("#app").textContent = runtime.listPacks()[0].id;
`,
  },
  {
    name: "react-dom-driver",
    requiresCandidateVersion: true,
    packages: ["@surfaceweave/core", "@surfaceweave/react"],
    dependencies: react,
    consumer: `import { InMemoryActionExecutionController, InMemorySurfaceStore, createStandardComponentRegistry } from "@surfaceweave/core";
import type { ActionExecutionStateSource, SurfaceRendererDriver, SurfaceViewReference } from "@surfaceweave/core";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
import { createReactDOMRendererDriver } from "@surfaceweave/react/dom";
const components = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(components);
const actionStateSource: ActionExecutionStateSource = new InMemoryActionExecutionController({ execute: async (intent) => ({ intentId: intent.id, status: "success" }) });
const driver: SurfaceRendererDriver<Element> = createReactDOMRendererDriver({
  store,
  componentRegistry: components,
  reactComponents: createStandardReactComponentRegistry(components),
  actionStateSource,
  enabledPackIds: ["default"],
  capabilities: ["web"],
  packPriorities: { default: 1 },
  supportedPackVersions: { default: ["1.0.0"] },
});
const reference: SurfaceViewReference = { surfaceId: "surface", mode: "compact" };
void [driver, reference];
`,
    viteEntry: `import { InMemoryActionExecutionController, InMemorySurfaceStore, createStandardComponentRegistry } from "@surfaceweave/core";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
import { createReactDOMRendererDriver } from "@surfaceweave/react/dom";
const components = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(components);
const actionStateSource = new InMemoryActionExecutionController({ execute: async (intent) => ({ intentId: intent.id, status: "success" }) });
store.createSurface({
  id: "surface",
  intent: "confirm",
  tree: { id: "confirm", component: "Confirm", props: { title: "Ready", message: "Mounted" } },
  data: {},
  context: {},
});
const driver = createReactDOMRendererDriver({
  store,
  componentRegistry: components,
  reactComponents: createStandardReactComponentRegistry(components),
  actionStateSource,
});
driver.mount(document.querySelector("#app"), { surfaceId: "surface", mode: "compact" });
`,
  },
  {
    name: "agentdown-vue-driver",
    requiresCandidateVersion: true,
    packages: ["@surfaceweave/core", "@surfaceweave/react"],
    dependencies: vueAgentdown,
    consumer: `import { createStandardComponentRegistry } from "@surfaceweave/core";
import type { SurfaceRendererDriver, SurfaceViewHandle } from "@surfaceweave/core";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
import { createReactDOMRendererDriver } from "@surfaceweave/react/dom";
import { RunSurface, defineAgnoToolComponents } from "agentdown";
import type { Component } from "vue";
const components = createStandardComponentRegistry();
const driver: SurfaceRendererDriver<Element> = createReactDOMRendererDriver({
  store: {} as never,
  componentRegistry: components,
  reactComponents: createStandardReactComponentRegistry(components),
});
const controlled = {} as Component<{ surfaceId: string }>;
const tools = defineAgnoToolComponents({ surfaceweave: { match: "ui.renderSurface", component: controlled } });
const handle = {} as SurfaceViewHandle;
void [driver, tools, handle, RunSurface];
`,
    vitest: true,
    viteBuild: true,
    files: {
      "vite.config.ts": `import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
`,
      "index.html": `<div id="app"></div><script type="module" src="/src/main.ts"></script>\n`,
      "src/main.ts": `import { createApp } from "vue";
import App from "./App.vue";
import "agentdown/style.css";

createApp(App).mount("#app");
`,
      "src/runtime.ts": `import {
  InMemorySurfaceStore,
  createStandardComponentRegistry,
  surfaceObservation,
  type ActionIntent,
  type SurfaceObservationListener,
} from "@surfaceweave/core";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
import { createReactDOMRendererDriver } from "@surfaceweave/react/dom";

export const componentRegistry = createStandardComponentRegistry();
export const store = new InMemorySurfaceStore(componentRegistry);
store.createSurface({
  id: "purchase",
  intent: "form",
  tree: {
    id: "purchase-stack",
    component: "Stack",
    props: {},
    children: [
      {
        id: "buyer",
        stableId: "purchase.buyer",
        component: "TextInput",
        props: { label: "Buyer" },
        binding: { path: "buyer", valueType: "string" },
      },
      {
        id: "tea-cards",
        component: "CardList",
        props: {
          title: "Tea",
          multiple: true,
          items: [{ id: "longjing", name: "Longjing" }],
        },
        binding: { path: "selection", valueType: "array" },
      },
    ],
  },
  data: { buyer: "Ada", selection: [] },
  context: {},
});
store.createSurface({
  id: "second",
  intent: "confirm",
  tree: {
    id: "second-confirm",
    component: "Confirm",
    props: { title: "Second surface", message: "Ready" },
  },
  data: {},
  context: {},
});

let activeSubscriptions = 0;
export const subscriptionEvents: string[] = [];
const observation = store[surfaceObservation];
const subscribe = observation.subscribe.bind(observation);
observation.subscribe = (surfaceId: string, listener: SurfaceObservationListener) => {
  activeSubscriptions += 1;
  subscriptionEvents.push(\`subscribe:\${surfaceId}:\${activeSubscriptions}\`);
  const unsubscribe = subscribe(surfaceId, listener);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    activeSubscriptions -= 1;
    subscriptionEvents.push(\`unsubscribe:\${surfaceId}:\${activeSubscriptions}\`);
    unsubscribe();
  };
};

export const actionIntents: ActionIntent[] = [];
export const driver = createReactDOMRendererDriver({
  store,
  componentRegistry,
  reactComponents: createStandardReactComponentRegistry(componentRegistry),
  onActionIntent: (intent) => actionIntents.push(intent),
  enabledPackIds: ["default"],
  capabilities: ["web"],
});

export function getActiveSubscriptionCount(): number {
  return activeSubscriptions;
}
`,
      "src/agentdown-runtime.ts": `import {
  createAgentRuntime,
  defineAgnoToolComponents,
} from "agentdown";
import AgentdownSurfaceBlock from "./AgentdownSurfaceBlock.vue";

export const agentRuntime = createAgentRuntime();
export const surfaceTools = defineAgnoToolComponents({
  surfaceweave: {
    match: "ui.renderSurface",
    component: AgentdownSurfaceBlock,
  },
});

agentRuntime.apply({
  type: "block.upsert",
  block: {
    id: "surface-tool-block",
    slot: "main",
    type: "tool",
    renderer: "surfaceweave",
    state: "settled",
    groupId: "turn:purchase",
    data: { surfaceId: "purchase" },
  },
});

export function switchChatSurface(surfaceId: string): void {
  agentRuntime.apply({
    type: "block.patch",
    id: "surface-tool-block",
    patch: { data: { surfaceId } },
  });
}
`,
      "src/use-surface-driver.ts": `import type {
  SurfaceViewHandle,
  SurfaceViewMode,
} from "@surfaceweave/core";
import { onBeforeUnmount, onMounted, type Ref, watch } from "vue";
import { driver } from "./runtime";

export function useSurfaceDriver(
  target: Ref<Element | null>,
  surfaceId: () => string,
  mode: SurfaceViewMode,
): void {
  let handle: SurfaceViewHandle | undefined;
  onMounted(() => {
    if (target.value === null) throw new Error("Missing mount target");
    handle = driver.mount(target.value, { surfaceId: surfaceId(), mode });
  });
  watch(surfaceId, (nextSurfaceId) => {
    handle?.update({ surfaceId: nextSurfaceId, mode });
  });
  onBeforeUnmount(() => handle?.unmount());
}
`,
      "src/SurfaceWeaveChatView.vue": `<script setup lang="ts">
import { ref } from "vue";
import { useSurfaceDriver } from "./use-surface-driver";

const props = defineProps<{ surfaceId: string }>();
const target = ref<Element | null>(null);
useSurfaceDriver(target, () => props.surfaceId, "compact");
</script>

<template><div ref="target" data-chat-surface /></template>
`,
      "src/SurfaceWeaveWorkspaceView.vue": `<script setup lang="ts">
import { ref } from "vue";
import { useSurfaceDriver } from "./use-surface-driver";

const props = defineProps<{ surfaceId: string }>();
const target = ref<Element | null>(null);
useSurfaceDriver(target, () => props.surfaceId, "workspace");
</script>

<template><div ref="target" data-workspace-surface /></template>
`,
      "src/AgentdownSurfaceBlock.vue": `<script setup lang="ts">
import SurfaceWeaveChatView from "./SurfaceWeaveChatView.vue";

defineProps<{ surfaceId: string }>();
</script>

<template>
  <section data-agentdown-surface-block>
    <SurfaceWeaveChatView :surface-id="surfaceId" />
  </section>
</template>
`,
      "src/App.vue": `<script setup lang="ts">
import { RunSurface } from "agentdown";
import { agentRuntime, surfaceTools } from "./agentdown-runtime";
import SurfaceWeaveWorkspaceView from "./SurfaceWeaveWorkspaceView.vue";
</script>

<template>
  <RunSurface
    :runtime="agentRuntime"
    :renderers="surfaceTools.renderers"
    :performance="{ lazyMount: false }"
  />
  <SurfaceWeaveWorkspaceView surface-id="purchase" />
</template>
`,
      "src/test-setup.ts": `class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  ResizeObserver: ObserverStub,
  IntersectionObserver: ObserverStub,
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
});
`,
      "src/integration.test.ts": `import { act } from "react";
import { createApp, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App.vue";
import { switchChatSurface } from "./agentdown-runtime";
import {
  actionIntents,
  getActiveSubscriptionCount,
  store,
  subscriptionEvents,
} from "./runtime";

async function settle(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function commit(action: () => void): Promise<void> {
  await act(async () => {
    action();
    await settle();
  });
}

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await settle();
  }
  throw new Error(
    \`Timed out waiting for renderer lifecycle state: active=\${getActiveSubscriptionCount()} events=\${subscriptionEvents.join("|")}\`,
  );
}

function input(element: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (valueSetter === undefined) {
    throw new Error("HTMLInputElement value setter is unavailable");
  }
  valueSetter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.replaceChildren();
  actionIntents.length = 0;
});

describe("Agentdown Vue tarball consumer", () => {
  it("shares lifecycle, data, actions, and Surface switching", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp(App);
    await commit(() => app.mount(host));

    const chatBlock = host.querySelector("[data-agentdown-surface-block]");
    const chat = chatBlock?.querySelector("[data-chat-surface]");
    const workspace = host.querySelector("[data-workspace-surface]");
    expect(chatBlock).not.toBeNull();
    expect(chat).not.toBeNull();
    expect(workspace).not.toBeNull();
    expect(chat?.querySelector("[data-surface-id='purchase']")).not.toBeNull();
    expect(
      workspace?.querySelector("[data-surface-id='purchase']"),
    ).not.toBeNull();
    await waitUntil(() => getActiveSubscriptionCount() === 2);
    expect(getActiveSubscriptionCount()).toBe(2);

    const chatInput = chat?.querySelector("input") as HTMLInputElement;
    const workspaceInput = workspace?.querySelector("input") as HTMLInputElement;
    await commit(() => input(chatInput, "Lin"));
    expect(workspaceInput.value).toBe("Lin");
    expect(store.requireSurface("purchase").data.buyer).toBe("Lin");

    await commit(() => input(workspaceInput, "Mei"));
    expect(chatInput.value).toBe("Mei");
    expect(store.requireSurface("purchase").data.buyer).toBe("Mei");

    const actionButton = [...(chat?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "Longjing",
    );
    await commit(() =>
      actionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
    expect(actionIntents).toHaveLength(1);
    expect(actionIntents[0]).toMatchObject({
      surfaceId: "purchase",
      nodeId: "tea-cards",
      action: "select",
      input: { value: ["longjing"] },
    });

    await commit(() => switchChatSurface("second"));
    expect(chat?.querySelector("[data-surface-id='second']")).not.toBeNull();
    expect(chat?.querySelector("[data-surface-id='purchase']")).toBeNull();
    expect(chat?.textContent).toContain("Second surface");
    expect(
      workspace?.querySelector("[data-surface-id='purchase']"),
    ).not.toBeNull();

    await commit(() => app.unmount());
    await waitUntil(() => getActiveSubscriptionCount() === 0);
    expect(getActiveSubscriptionCount()).toBe(0);
    expect(host.childElementCount).toBe(0);
  });
});
`,
    },
  },
  {
    name: "react-aria-only",
    packages: [
      "@surfaceweave/core",
      "@surfaceweave/react",
      "@surfaceweave/react-aria",
    ],
    dependencies: { ...react, "react-aria-components": "1.20.0" },
    consumer: `import { createStandardComponentRegistry } from "@surfaceweave/core";
import { createReactAriaComponentPack } from "@surfaceweave/react-aria";
import { validateReactComponentPack } from "@surfaceweave/react";
const registry = createStandardComponentRegistry();
const result: boolean = validateReactComponentPack(createReactAriaComponentPack(), registry).valid;
void result;
`,
    viteEntry: `import { createStandardComponentRegistry } from "@surfaceweave/core";
import { createReactAriaComponentPack } from "@surfaceweave/react-aria";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
const runtime = createStandardReactComponentRegistry(createStandardComponentRegistry());
runtime.registerPack(createReactAriaComponentPack());
document.querySelector("#app").textContent = runtime.listPacks().map((pack) => pack.id).join(",");
`,
  },
  {
    name: "antd-only",
    packages: [
      "@surfaceweave/core",
      "@surfaceweave/react",
      "@surfaceweave/antd",
    ],
    dependencies: { ...react, antd: "6.5.3" },
    consumer: `import { createStandardComponentRegistry } from "@surfaceweave/core";
import { createAntDesignComponentPack } from "@surfaceweave/antd";
import { validateReactComponentPack } from "@surfaceweave/react";
const registry = createStandardComponentRegistry();
const result: boolean = validateReactComponentPack(createAntDesignComponentPack(), registry).valid;
void result;
`,
    viteEntry: `import { createStandardComponentRegistry } from "@surfaceweave/core";
import { createAntDesignComponentPack } from "@surfaceweave/antd";
import { createStandardReactComponentRegistry } from "@surfaceweave/react";
const runtime = createStandardReactComponentRegistry(createStandardComponentRegistry());
runtime.registerPack(createAntDesignComponentPack());
document.querySelector("#app").textContent = runtime.listPacks().map((pack) => pack.id).join(",");
`,
  },
  {
    name: "tool-runtime",
    packages: [
      "@surfaceweave/core",
      "@surfaceweave/storage",
      "@surfaceweave/preferences",
      "@surfaceweave/generator",
      "@surfaceweave/agent-tools",
    ],
    dependencies: typescript,
    consumer: `import { ToolToUIRuntime } from "@surfaceweave/agent-tools";
import { InMemorySurfaceStore, createStandardComponentRegistry } from "@surfaceweave/core";
import type { ActionIntent, ToolDefinition, ToolSubmissionRequest } from "@surfaceweave/core";
import { fromOpenApiOperation } from "@surfaceweave/generator";
import type { OpenApiParameterSource, OpenApiParameterSourceKey } from "@surfaceweave/generator";
const definition: ToolDefinition = {
  id: "tea.search",
  version: "1.0.0",
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: { query: { type: "string" } },
  },
  outputSchema: { type: "object" },
};
const tenantKey: OpenApiParameterSourceKey = "header:X-Tenant-Id";
const tenantSource: OpenApiParameterSource = "host";
const openApiDefinition = fromOpenApiOperation({
  path: "/tea",
  method: "get",
  parameterSources: { [tenantKey]: tenantSource },
  document: {
    openapi: "3.1.1",
    info: { title: "Tea", version: "1.0.0" },
    paths: {
      "/tea": {
        get: {
          operationId: "tea.openapi.search",
          parameters: [
            { name: "query", in: "query", schema: { type: "string" } },
            { name: "X-Tenant-Id", in: "header", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "ok" } },
        },
      },
    },
  },
});
if (JSON.stringify(openApiDefinition.inputSchema).includes("X-Tenant-Id")) throw new Error("host parameter leaked");
const components = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(components);
const runtime = new ToolToUIRuntime(components, store);
runtime.registerTool(definition);
runtime.onInvocationRequested((request: ToolSubmissionRequest) => {
  runtime.markInvocationStarted(request.invocationId);
  runtime.resolveInvocation(request.invocationId, { teas: ["Longjing"] });
});
const { invocation, surface } = runtime.createToolSurface({
  toolId: definition.id,
  surfaceId: "tea-search",
  initialValues: { query: "green" },
});
const intent: ActionIntent = {
  id: "submit-tea-search",
  surfaceId: surface.id,
  nodeId: surface.tree.id,
  action: "tool.submit",
  input: { invocationId: invocation.id },
};
runtime.handleAction(intent);
`,
    smoke: `import { ToolToUIRuntime } from "@surfaceweave/agent-tools";
import { InMemorySurfaceStore, createStandardComponentRegistry } from "@surfaceweave/core";
const components = createStandardComponentRegistry();
const runtime = new ToolToUIRuntime(components, new InMemorySurfaceStore(components));
runtime.registerTool({ id: "tea.search", version: "1.0.0", inputSchema: { type: "object" } });
if (runtime.createToolSurface({ toolId: "tea.search", surfaceId: "tea-search" }).surface.id !== "tea-search") throw new Error("tool runtime");
`,
    publishedSmoke: `import { ToolToUIRuntime } from "@surfaceweave/agent-tools";
import { InMemorySurfaceStore, createStandardComponentRegistry } from "@surfaceweave/core";
const components = createStandardComponentRegistry();
const surfaces = new InMemorySurfaceStore(components);
const runtime = new ToolToUIRuntime(components, surfaces);
runtime.registerTool({
  id: "tea.search",
  version: "1.0.0",
  inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string" } } },
  outputSchema: { type: "object" },
});
runtime.onInvocationRequested((request) => {
  runtime.markInvocationStarted(request.invocationId);
  runtime.resolveInvocation(request.invocationId, { teas: ["Longjing"] });
});
const { invocation, surface } = runtime.createToolSurface({
  toolId: "tea.search",
  surfaceId: "tea-search",
  initialValues: { query: "green" },
});
runtime.handleAction({
  id: "submit-tea-search",
  surfaceId: surface.id,
  nodeId: surface.tree.id,
  action: "tool.submit",
  input: { invocationId: invocation.id },
});
const resolved = runtime.inspectInvocation(invocation.id);
if (resolved.status !== "success" || !resolved.resultSurfaceId) throw new Error("tool runtime");
if (!surfaces.getSurface(resolved.resultSurfaceId)) throw new Error("result surface");
`,
  },
  {
    name: "runtime-hardening",
    localOnly: true,
    packages: [
      "@surfaceweave/core",
      "@surfaceweave/storage",
      "@surfaceweave/preferences",
      "@surfaceweave/generator",
      "@surfaceweave/agent-tools",
    ],
    dependencies: typescript,
    consumer: `import { ToolToUIRuntime } from "@surfaceweave/agent-tools";
import type { ToolToUIRuntimeOptions } from "@surfaceweave/agent-tools";
import { InMemorySurfaceStore, createStandardComponentRegistry, recommendedSurfaceResourcePolicy } from "@surfaceweave/core";
import type { ActionExecutionStateSource, InMemorySurfaceStoreOptions, SurfaceResourcePolicy } from "@surfaceweave/core";
const policy: SurfaceResourcePolicy = { ...recommendedSurfaceResourcePolicy, maxNodes: 500 };
const components = createStandardComponentRegistry();
const storeOptions: InMemorySurfaceStoreOptions = { resourcePolicy: policy, onListenerError: () => undefined };
const store = new InMemorySurfaceStore(components, storeOptions);
const runtimeOptions: ToolToUIRuntimeOptions = { onListenerError: () => undefined };
const runtime = new ToolToUIRuntime(components, store, runtimeOptions);
const actionStateSource: ActionExecutionStateSource = runtime.actionStateSource;
void actionStateSource;
runtime.dispose();
store.dispose();
`,
    smoke: `import { ToolToUIRuntime } from "@surfaceweave/agent-tools";
import { InMemorySurfaceStore, createStandardComponentRegistry } from "@surfaceweave/core";
const components = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(components, { resourcePolicy: { maxNodes: 10 } });
const runtime = new ToolToUIRuntime(components, store);
runtime.dispose();
store.dispose();
`,
  },
  {
    name: "tauri-adapter",
    packages: [
      "@surfaceweave/core",
      "@surfaceweave/storage",
      "@surfaceweave/preferences",
      "@surfaceweave/tauri",
    ],
    dependencies: { ...typescript, vite: "8.2.0" },
    consumer: `import { createTauriDynamicUIAdapter } from "@surfaceweave/tauri";
import type { CreateTauriDynamicUIAdapterOptions, TauriDynamicUIAdapter } from "@surfaceweave/tauri";
const create: (options: CreateTauriDynamicUIAdapterOptions) => TauriDynamicUIAdapter = createTauriDynamicUIAdapter;
void create;
`,
    viteEntry: `import { createTauriDynamicUIAdapter } from "@surfaceweave/tauri";
globalThis.createTauriDynamicUIAdapter = createTauriDynamicUIAdapter;
document.querySelector("#app").textContent = "tauri-adapter-bundled";
`,
  },
];

try {
  let publishedVersion;
  if (values.published) {
    publishedVersion = JSON.parse(
      run(
        "npm",
        ["view", `@surfaceweave/react@${values.tag}`, "version", "--json"],
        repositoryRoot,
        true,
      ),
    );
  }
  const packageSpecs = values.published
    ? new Map(
        releasePackages.map((releasePackage) => [
          releasePackage.name,
          values.tag,
        ]),
      )
    : new Map(
        [...packPackages()].map(([name, tarball]) => [name, `file:${tarball}`]),
      );
  const selectedFixtures =
    values.fixture === undefined
      ? fixtures.filter(
          (fixture) =>
            (!values.published || fixture.localOnly !== true) &&
            (!values.published ||
              fixture.requiresCandidateVersion !== true ||
              publishedVersion === releaseVersion),
        )
      : fixtures.filter(
          (fixture) =>
            fixture.name === values.fixture &&
            (!values.published || fixture.localOnly !== true) &&
            (!values.published ||
              fixture.requiresCandidateVersion !== true ||
              publishedVersion === releaseVersion),
        );
  if (selectedFixtures.length === 0) {
    throw new Error(`Unknown consumer fixture: ${values.fixture}`);
  }
  for (const fixture of selectedFixtures) verifyFixture(packageSpecs, fixture);
  const skippedCandidateFixtures = values.published
    ? fixtures.filter(
        (fixture) =>
          fixture.requiresCandidateVersion === true &&
          publishedVersion !== releaseVersion,
      )
    : [];
  if (skippedCandidateFixtures.length > 0) {
    process.stdout.write(
      `Skipped candidate-only consumers (${skippedCandidateFixtures.map((fixture) => fixture.name).join(", ")}) because ${values.tag} is ${publishedVersion}, not ${releaseVersion}.\n`,
    );
  }
  process.stdout.write(
    `npm ${values.published ? "Registry" : "tarball"} verification passed for ${releasePackages.length} packages and ${selectedFixtures.length} clean consumers.\n`,
  );
} finally {
  if (values.keep) {
    process.stdout.write(`Kept consumer fixtures at ${fixtureRoot}\n`);
  } else if (existsSync(fixtureRoot)) {
    rmSync(fixtureRoot, { recursive: true });
  }
}
