import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { releasePackages } from "./release-packages.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const manifests = new Map();
const errors = [];
const warnings = [];

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

  for (const field of ["name", "version", "description", "license"]) {
    if (typeof manifest[field] !== "string" || manifest[field].trim() === "") {
      fail(`${releasePackage.directory}: missing ${field}`);
    }
  }
  if (manifest.private === true) fail(`${manifest.name}: must be publishable`);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail(`${manifest.name}: files must be explicit`);
  }
  if (manifest.exports === undefined) fail(`${manifest.name}: missing exports`);
  if (manifest.sideEffects === undefined) {
    fail(`${manifest.name}: missing sideEffects`);
  }
  if (
    manifest.publishConfig?.access !== "public" ||
    manifest.publishConfig?.tag !== "next"
  ) {
    fail(`${manifest.name}: publishConfig must use public/next`);
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
  }

  if (manifest.repository === undefined) {
    warnings.push(`${manifest.name}: repository URL awaits owner input`);
  }
  if (manifest.license === "UNLICENSED") {
    warnings.push(`${manifest.name}: public license awaits owner input`);
  }
}

const core = manifests.get("@surfaceweave/core");
const protocol = manifests.get("@surfaceweave/protocol");
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

if (errors.length > 0) {
  throw new Error(`Release package audit failed:\n- ${errors.join("\n- ")}`);
}

process.stdout.write(
  `Release package audit passed for ${releasePackages.length} packages.\n`,
);
for (const warning of warnings)
  process.stdout.write(`release-blocker: ${warning}\n`);
