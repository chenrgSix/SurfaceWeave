import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import {
  npmRegistry,
  releasePackages,
  releaseVersion,
  repositoryUrl,
} from "./release-packages.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const manifests = new Map();
const errors = [];
const rootLicense = readFileSync(resolve(repositoryRoot, "LICENSE"), "utf8");
const releasePackageNames = new Set(releasePackages.map((item) => item.name));

const releaseWorkflow = readFileSync(
  resolve(repositoryRoot, ".github/workflows/release.yml"),
  "utf8",
);
if (
  !releaseWorkflow.includes(
    'node scripts/publish-release-packages.mjs --tag "${DIST_TAG}"',
  ) ||
  releaseWorkflow.includes("npm publish")
) {
  fail(
    "Release workflow must use the integrity-aware resumable publish script",
  );
}

const allowedDependencies = {
  "@surfaceweave/protocol": [],
  "@surfaceweave/core": ["@cfworker/json-schema"],
  "@surfaceweave/storage": [],
  "@surfaceweave/preferences": ["@surfaceweave/core", "@surfaceweave/storage"],
  "@surfaceweave/generator": ["@surfaceweave/core"],
  "@surfaceweave/agent-tools": [
    "@surfaceweave/core",
    "@surfaceweave/generator",
    "@surfaceweave/preferences",
    "@surfaceweave/storage",
  ],
  "@surfaceweave/react": ["@surfaceweave/core"],
  "@surfaceweave/react-aria": ["@surfaceweave/core", "@surfaceweave/react"],
  "@surfaceweave/antd": ["@surfaceweave/core", "@surfaceweave/react"],
  "@surfaceweave/tauri": [
    "@surfaceweave/core",
    "@surfaceweave/preferences",
    "@surfaceweave/storage",
    "@tauri-apps/api",
    "@tauri-apps/plugin-store",
  ],
};

function fail(message) {
  errors.push(message);
}

for (const releasePackage of releasePackages) {
  const file = resolve(
    repositoryRoot,
    releasePackage.directory,
    "package.json",
  );
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  manifests.set(manifest.name, manifest);

  if (manifest.name !== releasePackage.name) {
    fail(
      `${releasePackage.directory}: expected ${releasePackage.name}, received ${manifest.name}`,
    );
  }

  for (const field of ["name", "version", "description", "license"]) {
    if (typeof manifest[field] !== "string" || manifest[field].trim() === "") {
      fail(`${releasePackage.directory}: missing ${field}`);
    }
  }
  if (manifest.private === true) fail(`${manifest.name}: must be publishable`);
  if (manifest.version !== releaseVersion) {
    fail(`${manifest.name}: version must be ${releaseVersion}`);
  }
  if (manifest.license !== "MIT") fail(`${manifest.name}: license must be MIT`);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail(`${manifest.name}: files must be explicit`);
  }
  if (!manifest.files?.includes("LICENSE")) {
    fail(`${manifest.name}: files must include LICENSE`);
  }
  try {
    const packageLicense = readFileSync(
      resolve(repositoryRoot, releasePackage.directory, "LICENSE"),
      "utf8",
    );
    if (packageLicense !== rootLicense) {
      fail(`${manifest.name}: LICENSE differs from repository root`);
    }
  } catch {
    fail(`${manifest.name}: package-local LICENSE is missing`);
  }
  if (manifest.exports === undefined) fail(`${manifest.name}: missing exports`);
  if (manifest.sideEffects === undefined) {
    fail(`${manifest.name}: missing sideEffects`);
  }
  if (
    manifest.publishConfig?.access !== "public" ||
    manifest.publishConfig?.tag !== "next" ||
    manifest.publishConfig?.registry !== npmRegistry
  ) {
    fail(
      `${manifest.name}: publishConfig must use public/next on ${npmRegistry}`,
    );
  }
  if (
    manifest.repository?.type !== "git" ||
    manifest.repository?.url !== repositoryUrl ||
    manifest.repository?.directory !== releasePackage.directory
  ) {
    fail(`${manifest.name}: repository metadata is not canonical`);
  }

  if (releasePackage.kind === "typescript") {
    for (const [field, expected] of [
      ["main", "./dist/index.js"],
      ["module", "./dist/index.js"],
      ["types", "./dist/index.d.ts"],
    ]) {
      if (manifest[field] !== expected) {
        fail(`${manifest.name}: ${field} must be ${expected}`);
      }
    }
    if (manifest.exports?.["."]?.default !== "./dist/index.js") {
      fail(`${manifest.name}: root export needs a default ESM target`);
    }
  }

  const dependencies = Object.keys(manifest.dependencies ?? {}).sort();
  const allowed = [...(allowedDependencies[manifest.name] ?? [])].sort();
  if (JSON.stringify(dependencies) !== JSON.stringify(allowed)) {
    fail(
      `${manifest.name}: dependency direction mismatch (${dependencies.join(", ")})`,
    );
  }
  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    if (String(range).startsWith("workspace:")) {
      fail(
        `${manifest.name}: ${name} uses a publish-incompatible workspace range`,
      );
    }
    if (releasePackageNames.has(name) && range !== releaseVersion) {
      fail(`${manifest.name}: ${name} must use exact range ${releaseVersion}`);
    }
  }
}

const core = manifests.get("@surfaceweave/core");
const protocol = manifests.get("@surfaceweave/protocol");
const react = manifests.get("@surfaceweave/react");
for (const [name, manifest] of [
  ["Core", core],
  ["Protocol", protocol],
]) {
  const serialized = JSON.stringify(manifest).toLowerCase();
  for (const forbidden of [
    "react",
    "react-dom",
    "antd",
    "react-aria",
    "@tauri-apps",
  ]) {
    if (serialized.includes(forbidden)) {
      fail(`${name}: forbidden dependency metadata contains ${forbidden}`);
    }
  }
}

if (
  react?.exports?.["./dom"]?.types !== "./dist/dom.d.ts" ||
  react?.exports?.["./dom"]?.import !== "./dist/dom.js" ||
  react?.exports?.["./dom"]?.default !== "./dist/dom.js"
) {
  fail("React: ./dom must expose isolated ESM and type entry points");
}
if (
  react?.peerDependencies?.["react-dom"] !== ">=18.2.0 <20" ||
  react?.peerDependenciesMeta?.["react-dom"]?.optional !== true
) {
  fail("React: react-dom must be an optional peer for the ./dom entry point");
}
try {
  const reactRootEntry = readFileSync(
    resolve(repositoryRoot, "packages/renderer-react/dist/index.js"),
    "utf8",
  );
  const reactDOMEntry = readFileSync(
    resolve(repositoryRoot, "packages/renderer-react/dist/dom.js"),
    "utf8",
  );
  if (/react-dom/.test(reactRootEntry)) {
    fail("React: root runtime entry must not import react-dom");
  }
  if (!/react-dom\/client/.test(reactDOMEntry)) {
    fail("React: ./dom runtime entry must own the react-dom/client import");
  }
} catch {
  fail("React: build outputs are missing; run pnpm build before audit:release");
}

if (errors.length > 0) {
  throw new Error(`Release package audit failed:\n- ${errors.join("\n- ")}`);
}

process.stdout.write(
  `Release package audit passed for ${releasePackages.length} packages.\n`,
);
