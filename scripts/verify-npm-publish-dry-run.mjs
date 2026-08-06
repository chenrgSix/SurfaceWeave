import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

import { npmRegistry, releasePackages } from "./release-packages.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");

for (const releasePackage of releasePackages) {
  const directory = resolve(repositoryRoot, releasePackage.directory);
  execFileSync(
    "npm",
    [
      "publish",
      "--dry-run",
      "--ignore-scripts",
      "--access",
      "public",
      "--tag",
      "next",
      "--registry",
      npmRegistry,
    ],
    {
      cwd: directory,
      env: {
        ...process.env,
        CI: "true",
        npm_config_registry: npmRegistry,
      },
      stdio: "inherit",
    },
  );
}

process.stdout.write(
  `npm publish --dry-run passed for ${releasePackages.length} packages; nothing was published.\n`,
);
