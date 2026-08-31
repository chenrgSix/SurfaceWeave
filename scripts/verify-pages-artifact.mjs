import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Fail deployment if the standalone app is absent or refers to root/dev assets. */
export function verifyPagesArtifact(directory) {
  const base = "/SurfaceWeave/";
  const home = readFileSync(resolve(directory, "index.html"), "utf8");
  if (!home.includes('href="/SurfaceWeave/playground/"'))
    throw new Error(
      "Documentation homepage is missing the live playground link.",
    );
  const app = readFileSync(resolve(directory, "playground/index.html"), "utf8");
  if (app.includes("/src/main.tsx") || app.includes("/@vite/client"))
    throw new Error("Playground contains development-only imports.");
  const assets = [...app.matchAll(/(?:src|href)="([^"]+)"/g)].map(
    (match) => match[1],
  );
  if (
    !assets.some((asset) => asset.endsWith(".js")) ||
    !assets.some((asset) => asset.endsWith(".css"))
  )
    throw new Error(
      "Playground is missing its production JavaScript or stylesheet.",
    );
  for (const asset of assets) {
    if (
      !asset.startsWith(`${base}playground/`) ||
      asset.includes("..") ||
      !existsSync(resolve(directory, asset.slice(base.length)))
    )
      throw new Error(
        `Playground asset is missing or outside its Pages base: ${asset}`,
      );
  }
}
