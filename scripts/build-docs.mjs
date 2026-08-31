import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { verifyPagesArtifact } from "./verify-pages-artifact.mjs";

const root = resolve(import.meta.dirname, "..");
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run this build with pnpm docs:build.");
function run(...args) {
  execFileSync(process.execPath, [pnpm, ...args], {
    cwd: root,
    stdio: "inherit",
  });
}

// Pages starts from a cold checkout; Vite imports the built SDK package exports.
run(
  "--filter",
  "@surfaceweave/operations-center^...",
  "--workspace-concurrency=1",
  "build",
);
run("exec", "vitepress", "build", "docs");
// Build after VitePress, which clears its output directory. The demo is a separate app.
run(
  "--filter",
  "@surfaceweave/operations-center",
  "exec",
  "vite",
  "build",
  "--base",
  "/SurfaceWeave/playground/",
  "--outDir",
  "../../docs/.vitepress/dist/playground",
  "--emptyOutDir",
);
verifyPagesArtifact(resolve(root, "docs/.vitepress/dist"));
console.log(
  "Verified Pages artifact: documentation + /SurfaceWeave/playground/",
);
