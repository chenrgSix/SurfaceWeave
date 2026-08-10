import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { parseArgs } from "node:util";

import {
  npmRegistry,
  releasePackages,
  releaseVersion,
} from "./release-packages.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");

export function comparePublishedArtifact(
  packageName,
  version,
  localIntegrity,
  publishedIntegrity,
) {
  if (publishedIntegrity === undefined) return "missing";
  if (publishedIntegrity === localIntegrity) return "identical";
  throw new Error(
    `${packageName}@${version} already exists with different integrity; refusing to overwrite an immutable npm version`,
  );
}

function run(command, arguments_, cwd, capture = false) {
  return execFileSync(command, arguments_, {
    cwd,
    encoding: capture ? "utf8" : undefined,
    env: { ...process.env, npm_config_registry: npmRegistry },
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
}

function publishedIntegrity(packageName, version) {
  const result = spawnSync(
    "npm",
    [
      "view",
      `${packageName}@${version}`,
      "dist.integrity",
      "--json",
      "--registry",
      npmRegistry,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, npm_config_registry: npmRegistry },
    },
  );
  if (result.status === 0) {
    const value = JSON.parse(result.stdout);
    return typeof value === "string" ? value : undefined;
  }
  if (`${result.stderr}\n${result.stdout}`.includes("E404")) return undefined;
  throw new Error(
    `Unable to inspect ${packageName}@${version}: ${result.stderr.trim() || result.stdout.trim()}`,
  );
}

function packIntegrity(releasePackage, tarballDirectory) {
  const directory = resolve(repositoryRoot, releasePackage.directory);
  const output = run(
    "npm",
    ["pack", "--json", "--pack-destination", tarballDirectory],
    directory,
    true,
  );
  const [result] = JSON.parse(output);
  if (
    result?.name !== releasePackage.name ||
    result?.version !== releaseVersion ||
    typeof result?.integrity !== "string"
  ) {
    throw new Error(
      `npm pack returned invalid metadata for ${releasePackage.name}`,
    );
  }
  const manifest = JSON.parse(
    readFileSync(resolve(directory, "package.json"), "utf8"),
  );
  if (manifest.version !== releaseVersion) {
    throw new Error(
      `${releasePackage.name} manifest is ${manifest.version}, expected ${releaseVersion}`,
    );
  }
  return result.integrity;
}

export function publishReleasePackages({ tag, provenance = true }) {
  const tarballDirectory = mkdtempSync(
    join(tmpdir(), "surfaceweave-publish-artifacts-"),
  );
  try {
    for (const releasePackage of releasePackages) {
      const localIntegrity = packIntegrity(releasePackage, tarballDirectory);
      const currentIntegrity = publishedIntegrity(
        releasePackage.name,
        releaseVersion,
      );
      const status = comparePublishedArtifact(
        releasePackage.name,
        releaseVersion,
        localIntegrity,
        currentIntegrity,
      );
      if (status === "identical") {
        process.stdout.write(
          `publish:skip:${releasePackage.name}@${releaseVersion}:identical\n`,
        );
        continue;
      }

      const publishArguments = [
        "publish",
        resolve(repositoryRoot, releasePackage.directory),
        "--access",
        "public",
        "--tag",
        tag,
        "--registry",
        npmRegistry,
      ];
      if (provenance) publishArguments.push("--provenance");
      try {
        run("npm", publishArguments, repositoryRoot);
      } catch (error) {
        const acceptedIntegrity = publishedIntegrity(
          releasePackage.name,
          releaseVersion,
        );
        if (
          comparePublishedArtifact(
            releasePackage.name,
            releaseVersion,
            localIntegrity,
            acceptedIntegrity,
          ) === "identical"
        ) {
          process.stdout.write(
            `publish:recovered:${releasePackage.name}@${releaseVersion}:registry-accepted\n`,
          );
          continue;
        }
        throw error;
      }
    }
  } finally {
    rmSync(tarballDirectory, { recursive: true, force: true });
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      tag: { type: "string" },
      provenance: { type: "boolean", default: true },
    },
  });
  if (values.tag === undefined || values.tag.trim() === "") {
    throw new Error("--tag is required");
  }
  publishReleasePackages({ tag: values.tag, provenance: values.provenance });
}

if (process.argv[1] !== undefined) {
  const invokedUrl = pathToFileURL(resolve(process.argv[1])).href;
  if (invokedUrl === import.meta.url) main();
}
