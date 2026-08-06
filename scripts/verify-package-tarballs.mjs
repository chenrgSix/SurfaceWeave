import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { releasePackages } from "./release-packages.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const fixtureRoot = mkdtempSync(join(tmpdir(), "package-first-consumers-"));
const tarballDirectory = join(fixtureRoot, "tarballs");
mkdirSync(tarballDirectory);

function run(command, arguments_, cwd, capture = false) {
  return execFileSync(command, arguments_, {
    cwd,
    encoding: capture ? "utf8" : undefined,
    env: { ...process.env, CI: "true" },
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

function verifyFixture(tarballs, fixture) {
  const directory = join(fixtureRoot, fixture.name);
  mkdirSync(directory);
  const dependencies = Object.fromEntries(
    fixture.packages.map((name) => [name, `file:${tarballs.get(name)}`]),
  );
  Object.assign(dependencies, fixture.dependencies ?? {});
  writeJson(join(directory, "package.json"), {
    name: `package-first-${fixture.name}`,
    private: true,
    type: "module",
    dependencies,
  });
  writeJson(join(directory, "tsconfig.json"), {
    compilerOptions: commonCompilerOptions,
    include: ["consumer.ts"],
  });
  writeFileSync(join(directory, "consumer.ts"), fixture.consumer);
  if (fixture.smoke !== undefined) {
    writeFileSync(join(directory, "smoke.mjs"), fixture.smoke);
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
  const installedScope = join(directory, "node_modules", "@package-first");
  const installed = existsSync(installedScope)
    ? readdirSync(installedScope).sort()
    : [];
  const expected = fixture.packages
    .map((name) => name.replace("@package-first/", ""))
    .sort();
  if (JSON.stringify(installed) !== JSON.stringify(expected)) {
    throw new Error(
      `${fixture.name}: installed Package First packages ${installed.join(", ")}; expected ${expected.join(", ")}`,
    );
  }
  run("npm", ["exec", "tsc", "--", "-p", "tsconfig.json"], directory);
  if (fixture.smoke !== undefined) run("node", ["smoke.mjs"], directory);
  if (fixture.viteEntry !== undefined) {
    run("npm", ["exec", "vite", "--", "build"], directory);
  }
  process.stdout.write(`consumer:${fixture.name}:passed\n`);
}

const typescript = { typescript: "6.0.2" };
const react = {
  ...typescript,
  react: "19.2.8",
  "react-dom": "19.2.8",
  "@types/react": "19.2.18",
  "@types/react-dom": "19.2.4",
  vite: "8.2.0",
};

const fixtures = [
  {
    name: "protocol",
    packages: ["@package-first/protocol"],
    dependencies: typescript,
    consumer: `import schema from "@package-first/protocol/schema" with { type: "json" };
const dialect: string = schema.$schema;
void dialect;
`,
    smoke: `import schema from "@package-first/protocol/schema" with { type: "json" };
if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") throw new Error("protocol");
`,
  },
  {
    name: "core-only",
    packages: ["@package-first/core"],
    dependencies: typescript,
    consumer: `import { InMemorySurfaceStore, createStandardComponentRegistry } from "@package-first/core";
import type { ActionIntent, Surface, ToolDefinition, UINode } from "@package-first/core";
const node: UINode = { id: "root", component: "Stack", props: {} };
const surface: Surface = { id: "surface", revision: 0, intent: "form", tree: node, data: {}, context: {} };
const tool: ToolDefinition = { id: "tea.search", version: "1.0.0", inputSchema: { type: "object" } };
const intent: ActionIntent = { id: "intent", surfaceId: surface.id, nodeId: node.id, action: "submit", input: null };
const store = new InMemorySurfaceStore(createStandardComponentRegistry());
void [tool, intent, store];
`,
    smoke: `import { InMemorySurfaceStore, createStandardComponentRegistry } from "@package-first/core";
const registry = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(registry);
if (store.getSurface("missing") !== undefined) throw new Error("core");
try {
  await import("@package-first/core/types");
  throw new Error("internal Core subpath was exported");
} catch (error) {
  if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
}
`,
  },
  {
    name: "react-default",
    packages: ["@package-first/core", "@package-first/renderer-react"],
    dependencies: react,
    consumer: `import { createStandardComponentRegistry } from "@package-first/core";
import { createDefaultReactComponentPack, createStandardReactComponentRegistry } from "@package-first/renderer-react";
import type { ReactComponentPack, SurfaceRendererProps } from "@package-first/renderer-react";
const registry = createStandardComponentRegistry();
const pack: ReactComponentPack = createDefaultReactComponentPack();
const renderer = createStandardReactComponentRegistry(registry);
const props = {} as SurfaceRendererProps;
void [pack, renderer, props];
`,
    viteEntry: `import { createStandardComponentRegistry } from "@package-first/core";
import { createStandardReactComponentRegistry } from "@package-first/renderer-react";
const runtime = createStandardReactComponentRegistry(createStandardComponentRegistry());
document.querySelector("#app").textContent = runtime.listPacks()[0].id;
`,
  },
  {
    name: "react-aria-only",
    packages: [
      "@package-first/core",
      "@package-first/renderer-react",
      "@package-first/component-pack-react-aria",
    ],
    dependencies: { ...react, "react-aria-components": "1.20.0" },
    consumer: `import { createStandardComponentRegistry } from "@package-first/core";
import { createReactAriaComponentPack } from "@package-first/component-pack-react-aria";
import { validateReactComponentPack } from "@package-first/renderer-react";
const registry = createStandardComponentRegistry();
const result: boolean = validateReactComponentPack(createReactAriaComponentPack(), registry).valid;
void result;
`,
    viteEntry: `import { createStandardComponentRegistry } from "@package-first/core";
import { createReactAriaComponentPack } from "@package-first/component-pack-react-aria";
import { createStandardReactComponentRegistry } from "@package-first/renderer-react";
const runtime = createStandardReactComponentRegistry(createStandardComponentRegistry());
runtime.registerPack(createReactAriaComponentPack());
document.querySelector("#app").textContent = runtime.listPacks().map((pack) => pack.id).join(",");
`,
  },
  {
    name: "antd-only",
    packages: [
      "@package-first/core",
      "@package-first/renderer-react",
      "@package-first/component-pack-antd",
    ],
    dependencies: { ...react, antd: "6.5.3" },
    consumer: `import { createStandardComponentRegistry } from "@package-first/core";
import { createAntDesignComponentPack } from "@package-first/component-pack-antd";
import { validateReactComponentPack } from "@package-first/renderer-react";
const registry = createStandardComponentRegistry();
const result: boolean = validateReactComponentPack(createAntDesignComponentPack(), registry).valid;
void result;
`,
    viteEntry: `import { createStandardComponentRegistry } from "@package-first/core";
import { createAntDesignComponentPack } from "@package-first/component-pack-antd";
import { createStandardReactComponentRegistry } from "@package-first/renderer-react";
const runtime = createStandardReactComponentRegistry(createStandardComponentRegistry());
runtime.registerPack(createAntDesignComponentPack());
document.querySelector("#app").textContent = runtime.listPacks().map((pack) => pack.id).join(",");
`,
  },
  {
    name: "tool-runtime",
    packages: [
      "@package-first/core",
      "@package-first/storage",
      "@package-first/preferences",
      "@package-first/generator",
      "@package-first/agent-tools",
    ],
    dependencies: typescript,
    consumer: `import { ToolToUIRuntime } from "@package-first/agent-tools";
import { InMemorySurfaceStore, createStandardComponentRegistry } from "@package-first/core";
import type { ToolDefinition, ToolSubmissionRequest } from "@package-first/core";
const definition: ToolDefinition = { id: "tea.search", version: "1.0.0", inputSchema: { type: "object" } };
const components = createStandardComponentRegistry();
const runtime = new ToolToUIRuntime(components, new InMemorySurfaceStore(components));
runtime.registerTool(definition);
runtime.onInvocationRequested((request: ToolSubmissionRequest) => void request);
runtime.createToolSurface({ toolId: definition.id, surfaceId: "tea-search" });
`,
    smoke: `import { ToolToUIRuntime } from "@package-first/agent-tools";
import { InMemorySurfaceStore, createStandardComponentRegistry } from "@package-first/core";
const components = createStandardComponentRegistry();
const runtime = new ToolToUIRuntime(components, new InMemorySurfaceStore(components));
runtime.registerTool({ id: "tea.search", version: "1.0.0", inputSchema: { type: "object" } });
if (runtime.createToolSurface({ toolId: "tea.search", surfaceId: "tea-search" }).surface.id !== "tea-search") throw new Error("tool runtime");
`,
  },
  {
    name: "tauri-adapter",
    packages: [
      "@package-first/core",
      "@package-first/storage",
      "@package-first/preferences",
      "@package-first/tauri",
    ],
    dependencies: { ...typescript, vite: "8.2.0" },
    consumer: `import { createTauriDynamicUIAdapter } from "@package-first/tauri";
import type { CreateTauriDynamicUIAdapterOptions, TauriDynamicUIAdapter } from "@package-first/tauri";
const create: (options: CreateTauriDynamicUIAdapterOptions) => TauriDynamicUIAdapter = createTauriDynamicUIAdapter;
void create;
`,
    viteEntry: `import { createTauriDynamicUIAdapter } from "@package-first/tauri";
globalThis.createTauriDynamicUIAdapter = createTauriDynamicUIAdapter;
document.querySelector("#app").textContent = "tauri-adapter-bundled";
`,
  },
];

try {
  const tarballs = packPackages();
  for (const fixture of fixtures) verifyFixture(tarballs, fixture);
  process.stdout.write(
    `npm tarball verification passed for ${releasePackages.length} packages and ${fixtures.length} clean consumers.\n`,
  );
} finally {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true });
}
