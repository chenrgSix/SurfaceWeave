import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Core framework boundary", () => {
  it("has no renderer dependency and builds without DOM libraries", () => {
    const packageRoot = new URL("../", import.meta.url);
    const packageJson = JSON.parse(
      readFileSync(new URL("package.json", packageRoot), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const buildConfig = JSON.parse(
      readFileSync(new URL("tsconfig.json", packageRoot), "utf8"),
    ) as { compilerOptions?: { lib?: string[] } };
    const dependencies = Object.keys(packageJson.dependencies ?? {});

    expect(dependencies).toEqual(["ajv"]);
    expect(buildConfig.compilerOptions?.lib).toEqual(["ES2022"]);
    expect(
      dependencies.some((name) =>
        /react|react-dom|react-aria|antd|tauri/i.test(name),
      ),
    ).toBe(false);
    expect(
      buildConfig.compilerOptions?.lib?.some((name) => /dom/i.test(name)),
    ).toBe(false);
    expect(fileURLToPath(packageRoot)).toContain("packages/core");
  });
});
