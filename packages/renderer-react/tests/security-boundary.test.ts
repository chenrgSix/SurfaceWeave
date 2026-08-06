import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory = fileURLToPath(new URL(".", import.meta.url));
const sourceDirectories = [
  resolve(testDirectory, "../src"),
  resolve(testDirectory, "../../component-pack-react-aria/src"),
  resolve(testDirectory, "../../component-pack-antd/src"),
];

describe("React renderer security boundary", () => {
  it("contains no dynamic-code or raw-HTML sink", () => {
    for (const directory of sourceDirectories) {
      for (const file of readdirSync(directory)) {
        if (!/\.tsx?$/.test(file)) continue;
        const source = readFileSync(resolve(directory, file), "utf8");
        expect(source).not.toMatch(
          /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|\bnew\s+Function\s*\(/,
        );
      }
    }
  });
});
