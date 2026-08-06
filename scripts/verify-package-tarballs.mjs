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
import { join, resolve } from "node:path";
import process from "node:process";

const repositoryRoot = resolve(import.meta.dirname, "..");
const packageDirectories = [
  "protocol",
  "packages/core",
  "packages/storage",
  "packages/preferences",
  "packages/generator",
  "packages/agent-tools",
  "packages/renderer-react",
  "packages/component-pack-react-aria",
  "packages/component-pack-antd",
];
const fixtureRoot = mkdtempSync(join(tmpdir(), "package-first-consumer-"));
const tarballDirectory = join(fixtureRoot, "tarballs");
mkdirSync(tarballDirectory);

function run(command, arguments_, cwd) {
  execFileSync(command, arguments_, {
    cwd,
    env: { ...process.env, CI: "true" },
    stdio: "inherit",
  });
}

try {
  const tarballs = new Map();
  for (const relativeDirectory of packageDirectories) {
    const packageDirectory = join(repositoryRoot, relativeDirectory);
    const packageJson = JSON.parse(
      readFileSync(join(packageDirectory, "package.json"), "utf8"),
    );
    const before = new Set(readdirSync(tarballDirectory));
    run(
      "pnpm",
      ["pack", "--pack-destination", tarballDirectory],
      packageDirectory,
    );
    const tarball = readdirSync(tarballDirectory).find(
      (entry) => !before.has(entry),
    );
    if (tarball === undefined) {
      throw new Error(`pnpm pack produced no tarball for ${packageJson.name}`);
    }
    tarballs.set(packageJson.name, join(tarballDirectory, tarball));
  }

  const dependencies = Object.fromEntries(
    [...tarballs].map(([name, tarball]) => [name, `file:${tarball}`]),
  );
  Object.assign(dependencies, {
    ajv: "8.17.1",
    antd: "6.5.3",
    react: "19.2.8",
    "react-aria-components": "1.20.0",
    "react-dom": "19.2.8",
    typescript: "6.0.2",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
  });
  writeFileSync(
    join(fixtureRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "package-first-tarball-consumer",
        private: true,
        type: "module",
        dependencies,
        pnpm: { overrides: dependencies },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(fixtureRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
          jsx: "react-jsx",
          skipLibCheck: true,
        },
        include: ["consumer.ts"],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(fixtureRoot, "consumer.ts"),
    `import protocolSchema from "@package-first/protocol/schema" with { type: "json" };
import { createStandardComponentRegistry } from "@package-first/core";
import { InMemorySurfaceStore } from "@package-first/core";
import { ToolToUIRuntime } from "@package-first/agent-tools";
import { createDefaultReactComponentPack, validateReactComponentPack } from "@package-first/renderer-react";
import { createReactAriaComponentPack } from "@package-first/component-pack-react-aria";
import { createAntDesignComponentPack } from "@package-first/component-pack-antd";

const registry = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(registry);
const tools = new ToolToUIRuntime(registry, store);
tools.registerTool({ id: "smoke.search", version: "1.0.0", inputSchema: { type: "object" } });
if (tools.createToolSurface({ toolId: "smoke.search", surfaceId: "smoke-form" }).surface.id !== "smoke-form") throw new Error("tool runtime");
const packs = [
  createDefaultReactComponentPack(),
  createReactAriaComponentPack(),
  createAntDesignComponentPack(),
];
for (const pack of packs) {
  if (!validateReactComponentPack(pack, registry).valid) throw new Error(pack.manifest.id);
}
if (protocolSchema.$schema !== "https://json-schema.org/draft/2020-12/schema") throw new Error("schema");
`,
  );
  writeFileSync(
    join(fixtureRoot, "smoke.mjs"),
    `import { existsSync } from "node:fs";
import protocolSchema from "@package-first/protocol/schema" with { type: "json" };
import { createStandardComponentRegistry } from "@package-first/core";
import { InMemorySurfaceStore } from "@package-first/core";
import { ToolToUIRuntime } from "@package-first/agent-tools";
import { createDefaultReactComponentPack, validateReactComponentPack } from "@package-first/renderer-react";
import { createReactAriaComponentPack } from "@package-first/component-pack-react-aria";
import { createAntDesignComponentPack } from "@package-first/component-pack-antd";

const registry = createStandardComponentRegistry();
const store = new InMemorySurfaceStore(registry);
const tools = new ToolToUIRuntime(registry, store);
tools.registerTool({ id: "smoke.search", version: "1.0.0", inputSchema: { type: "object" } });
tools.createToolSurface({ toolId: "smoke.search", surfaceId: "smoke-form" });
for (const pack of [createDefaultReactComponentPack(), createReactAriaComponentPack(), createAntDesignComponentPack()]) {
  const result = validateReactComponentPack(pack, registry);
  if (!result.valid) throw new Error(result.errors.join("; "));
  console.log("smoke:" + pack.manifest.rendererKind + "/" + pack.manifest.id);
}
if (protocolSchema.$id === undefined) throw new Error("Protocol schema export failed");
if (!existsSync(new URL(import.meta.resolve("@package-first/component-pack-react-aria/styles.css")))) {
  throw new Error("React Aria stylesheet export failed");
}
`,
  );

  run(
    "pnpm",
    ["install", "--ignore-scripts", "--no-frozen-lockfile"],
    fixtureRoot,
  );
  run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], fixtureRoot);
  run("node", ["smoke.mjs"], fixtureRoot);
  process.stdout.write("Tarball consumer verification passed.\n");
} finally {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true });
}
