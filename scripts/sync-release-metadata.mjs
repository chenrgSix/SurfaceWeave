import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import {
  npmRegistry,
  releasePackages,
  releaseVersion,
  repositoryUrl,
} from "./release-packages.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const mode = process.argv[2];

if (mode !== "--check" && mode !== "--write") {
  throw new Error("Usage: sync-release-metadata.mjs --check|--write");
}

const rootLicense = readFileSync(resolve(repositoryRoot, "LICENSE"), "utf8");
const packageNames = new Set(releasePackages.map((item) => item.name));
const packageIndexes = new Map(
  releasePackages.map((item, index) => [item.name, index]),
);
const errors = [];

function expectedManifest(releasePackage, manifest) {
  const dependencies = { ...(manifest.dependencies ?? {}) };
  for (const name of Object.keys(dependencies)) {
    if (packageNames.has(name)) dependencies[name] = releaseVersion;
  }

  return {
    ...manifest,
    version: releaseVersion,
    license: "MIT",
    repository: {
      type: "git",
      url: repositoryUrl,
      directory: releasePackage.directory,
    },
    files: [...new Set([...(manifest.files ?? []), "LICENSE"])],
    publishConfig: {
      ...(manifest.publishConfig ?? {}),
      access: "public",
      tag: "next",
      registry: npmRegistry,
    },
    ...(manifest.dependencies === undefined ? {} : { dependencies }),
  };
}

for (const [index, releasePackage] of releasePackages.entries()) {
  const packageRoot = resolve(repositoryRoot, releasePackage.directory);
  const manifestPath = resolve(packageRoot, "package.json");
  const licensePath = resolve(packageRoot, "LICENSE");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const expected = expectedManifest(releasePackage, manifest);

  if (manifest.name !== releasePackage.name) {
    errors.push(
      `${releasePackage.directory}: expected ${releasePackage.name}, received ${manifest.name}`,
    );
  }

  for (const name of Object.keys(expected.dependencies ?? {})) {
    const dependencyIndex = packageIndexes.get(name);
    if (dependencyIndex !== undefined && dependencyIndex >= index) {
      errors.push(
        `${releasePackage.name}: ${name} must appear earlier in release order`,
      );
    }
  }

  if (mode === "--write") {
    writeFileSync(manifestPath, `${JSON.stringify(expected, null, 2)}\n`);
    writeFileSync(licensePath, rootLicense);
    continue;
  }

  if (JSON.stringify(manifest) !== JSON.stringify(expected)) {
    errors.push(`${releasePackage.name}: release metadata is not synchronized`);
  }
  let packageLicense;
  try {
    packageLicense = readFileSync(licensePath, "utf8");
  } catch {
    errors.push(`${releasePackage.name}: package-local LICENSE is missing`);
    continue;
  }
  if (packageLicense !== rootLicense) {
    errors.push(`${releasePackage.name}: LICENSE differs from repository root`);
  }
}

if (errors.length > 0) {
  throw new Error(`Release metadata check failed:\n- ${errors.join("\n- ")}`);
}

process.stdout.write(
  `Release metadata ${mode === "--write" ? "synchronized" : "verified"} for ${releasePackages.length} packages at ${releaseVersion}.\n`,
);
