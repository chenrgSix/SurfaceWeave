import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { verifyPagesArtifact } from "./verify-pages-artifact.mjs";

const directories = [];
function artifact(
  html = '<script src="/SurfaceWeave/playground/assets/app.js"></script><link href="/SurfaceWeave/playground/assets/app.css"><link href="/SurfaceWeave/playground/favicon.svg">',
) {
  const directory = mkdtempSync(join(tmpdir(), "surfaceweave-pages-test-"));
  directories.push(directory);
  mkdirSync(join(directory, "playground/assets"), { recursive: true });
  writeFileSync(
    join(directory, "index.html"),
    '<a href="/SurfaceWeave/playground/" target="_self">Playground</a>',
  );
  writeFileSync(join(directory, "playground/index.html"), html);
  writeFileSync(
    join(directory, "playground/assets/app.js"),
    "console.log('production')",
  );
  writeFileSync(join(directory, "playground/assets/app.css"), "body{}");
  writeFileSync(join(directory, "playground/favicon.svg"), "<svg/>");
  return directory;
}
afterEach(() =>
  directories
    .splice(0)
    .forEach((directory) =>
      rmSync(directory, { recursive: true, force: true }),
    ),
);
it("accepts production assets under the GitHub project subpath", () => {
  expect(() => verifyPagesArtifact(artifact())).not.toThrow();
});
it.each([
  '<script src="/assets/app.js"></script><link href="/SurfaceWeave/playground/assets/app.css">',
  '<script src="/SurfaceWeave/playground/assets/missing.js"></script><link href="/SurfaceWeave/playground/assets/app.css">',
  '<script src="/src/main.tsx"></script>',
  '<script src="/SurfaceWeave/playground/assets/app.js"></script>',
  '<script src="/SurfaceWeave/playground/../assets/app.js"></script><link href="/SurfaceWeave/playground/assets/app.css">',
])("rejects broken or unsafe production asset references", (html) => {
  expect(() => verifyPagesArtifact(artifact(html))).toThrow();
});
it("rejects docs-only output and missing homepage entry", () => {
  const directory = artifact();
  rmSync(join(directory, "playground/index.html"));
  expect(() => verifyPagesArtifact(directory)).toThrow();
  writeFileSync(join(directory, "index.html"), "No demo link");
  expect(() => verifyPagesArtifact(directory)).toThrow("homepage");
});
