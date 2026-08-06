import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Tauri dependency boundary", () => {
  it("keeps all Tauri dependencies out of the core package", () => {
    const corePackage = JSON.parse(
      readFileSync(new URL("../../core/package.json", import.meta.url), "utf8"),
    ) as Record<string, unknown>;

    expect(JSON.stringify(corePackage)).not.toContain("@tauri-apps/");
    expect(
      Object.keys(corePackage.dependencies ?? {}).some((dependency) =>
        /react|react-dom|react-aria|antd|tauri/i.test(dependency),
      ),
    ).toBe(false);
  });
});
