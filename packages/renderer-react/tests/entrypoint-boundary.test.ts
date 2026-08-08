import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("React package entry points", () => {
  it("keeps react-dom isolated to the optional dom subpath", () => {
    const packageRoot = new URL("../", import.meta.url);
    const manifest = JSON.parse(
      readFileSync(new URL("package.json", packageRoot), "utf8"),
    ) as {
      exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    const rootSource = readFileSync(
      new URL("src/index.ts", packageRoot),
      "utf8",
    );
    const rootBuild = readFileSync(
      new URL("dist/index.js", packageRoot),
      "utf8",
    );

    expect(manifest.exports?.["./dom"]).toBeDefined();
    expect(manifest.peerDependencies?.["react-dom"]).toBe(">=18.2.0 <20");
    expect(manifest.peerDependenciesMeta?.["react-dom"]?.optional).toBe(true);
    expect(rootSource).not.toMatch(/react-dom|\.\/dom/);
    expect(rootBuild).not.toMatch(/react-dom|\.\/dom/);
  });
});
