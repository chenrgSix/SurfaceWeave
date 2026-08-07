import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { parseArgs } from "node:util";

import {
  npmRegistry,
  releasePackages,
  releaseVersion,
} from "./release-packages.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const rootLicense = readFileSync(resolve(repositoryRoot, "LICENSE"), "utf8");
const { values } = parseArgs({
  args: process.argv.slice(2).filter((value, index) => {
    return index !== 0 || value !== "--";
  }),
  options: {
    commit: { type: "string" },
    tag: { type: "string", default: "next" },
    version: { type: "string", default: releaseVersion },
  },
});
const expectedVersion = values.version;
const expectedTag = values.tag;
const expectedCommit = values.commit;
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "surfaceweave-published-packages-"),
);

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertEqual(packageName, field, actual, expected) {
  if (!equal(actual, expected)) {
    throw new Error(
      `${packageName}: published ${field} does not match the release manifest`,
    );
  }
}

function registryUrl(packageName) {
  return new URL(encodeURIComponent(packageName), npmRegistry).toString();
}

async function download(url) {
  const response = await globalThis.fetch(url, {
    headers: { accept: "application/vnd.npm.install-v1+json" },
  });
  if (!response.ok) {
    throw new Error(`${url}: registry returned ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function readRegistryDocument(packageName) {
  const response = await globalThis.fetch(registryUrl(packageName), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${packageName}: registry returned ${response.status}`);
  }
  return response.json();
}

function readTarEntry(tarball, entry) {
  return execFileSync("tar", ["-xOf", tarball, entry], {
    encoding: "utf8",
  });
}

function listTarEntries(tarball) {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
}

async function verifyPackage(releasePackage) {
  const localManifest = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, releasePackage.directory, "package.json"),
      "utf8",
    ),
  );
  const registryDocument = await readRegistryDocument(releasePackage.name);
  const published = registryDocument.versions?.[expectedVersion];
  if (published === undefined) {
    throw new Error(
      `${releasePackage.name}: ${expectedVersion} is not published`,
    );
  }
  if (registryDocument["dist-tags"]?.[expectedTag] !== expectedVersion) {
    throw new Error(
      `${releasePackage.name}: ${expectedTag} does not resolve to ${expectedVersion}`,
    );
  }

  const tarballUrl = published.dist?.tarball;
  const integrity = published.dist?.integrity;
  const shasum = published.dist?.shasum;
  if (
    typeof tarballUrl !== "string" ||
    !tarballUrl.startsWith(npmRegistry) ||
    typeof integrity !== "string" ||
    !integrity.startsWith("sha512-") ||
    typeof shasum !== "string"
  ) {
    throw new Error(`${releasePackage.name}: incomplete distribution metadata`);
  }

  const bytes = await download(tarballUrl);
  const calculatedIntegrity = `sha512-${createHash("sha512")
    .update(bytes)
    .digest("base64")}`;
  const calculatedShasum = createHash("sha1").update(bytes).digest("hex");
  if (calculatedIntegrity !== integrity || calculatedShasum !== shasum) {
    throw new Error(`${releasePackage.name}: tarball checksum mismatch`);
  }

  const tarball = join(
    temporaryDirectory,
    `${releasePackage.name.replace("@surfaceweave/", "")}.tgz`,
  );
  writeFileSync(tarball, bytes);
  const entries = listTarEntries(tarball);
  if (
    !entries.includes("package/package.json") ||
    !entries.includes("package/LICENSE")
  ) {
    throw new Error(
      `${releasePackage.name}: tarball is missing package.json or LICENSE`,
    );
  }
  if (published.dist.fileCount !== entries.length) {
    throw new Error(
      `${releasePackage.name}: registry fileCount does not match the tarball`,
    );
  }

  const packedManifest = JSON.parse(
    readTarEntry(tarball, "package/package.json"),
  );
  if (readTarEntry(tarball, "package/LICENSE") !== rootLicense) {
    throw new Error(
      `${releasePackage.name}: tarball LICENSE is not canonical MIT`,
    );
  }

  for (const field of [
    "name",
    "version",
    "description",
    "license",
    "repository",
    "files",
    "exports",
    "types",
    "main",
    "module",
    "sideEffects",
    "dependencies",
    "peerDependencies",
    "publishConfig",
  ]) {
    assertEqual(
      releasePackage.name,
      field,
      packedManifest[field],
      localManifest[field],
    );
  }
  assertEqual(
    releasePackage.name,
    "version metadata",
    published.version,
    expectedVersion,
  );
  assertEqual(
    releasePackage.name,
    "license metadata",
    published.license,
    "MIT",
  );
  assertEqual(
    releasePackage.name,
    "repository metadata",
    published.repository,
    localManifest.repository,
  );
  assertEqual(
    releasePackage.name,
    "dependencies metadata",
    published.dependencies,
    localManifest.dependencies,
  );
  assertEqual(
    releasePackage.name,
    "peerDependencies metadata",
    published.peerDependencies,
    localManifest.peerDependencies,
  );
  if (expectedCommit !== undefined && published.gitHead !== expectedCommit) {
    throw new Error(
      `${releasePackage.name}: gitHead ${published.gitHead ?? "missing"} does not match ${expectedCommit}`,
    );
  }

  const tags = Object.entries(registryDocument["dist-tags"] ?? {})
    .map(([tag, version]) => `${tag}=${version}`)
    .join(",");
  process.stdout.write(
    `published:${releasePackage.name}@${expectedVersion}:files=${entries.length}:integrity=${integrity}:tags=${tags}:passed\n`,
  );
}

try {
  for (const releasePackage of releasePackages) {
    await verifyPackage(releasePackage);
  }
  process.stdout.write(
    `Published package verification passed for ${releasePackages.length} packages.\n`,
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true });
}
