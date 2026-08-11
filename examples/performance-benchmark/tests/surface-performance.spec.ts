import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

interface CommitResult {
  durationMs: number;
  renders: Record<string, number>;
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * ratio) - 1] ?? 0;
}

test("keeps a 2,000-node one-path update within one frame", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  const mountDurations: number[] = [];
  for (let index = 0; index < 6; index += 1) {
    const mounted = await page.evaluate(() =>
      window.surfaceweavePerformance.mount(2_000),
    );
    if (index > 0) mountDurations.push(mounted.durationMs);
  }

  for (let index = 0; index < 5; index += 1) {
    await page.evaluate(() => window.surfaceweavePerformance.update(0));
  }
  const updates: CommitResult[] = [];
  for (let index = 0; index < 20; index += 1) {
    updates.push(
      await page.evaluate(() => window.surfaceweavePerformance.update(0)),
    );
  }

  for (const update of updates) {
    expect(update.renders.field0).toBe(1);
    expect(update.renders.field1 ?? 0).toBe(0);
    expect(update.renders.root ?? 0).toBe(0);
  }
  const updateDurations = updates.map((update) => update.durationMs);
  const report = {
    browserName,
    node: process.version,
    userAgent: await page.evaluate(() => navigator.userAgent),
    nodes: 2_000,
    samples: updateDurations.length,
    initialMount: {
      p50Ms: percentile(mountDurations, 0.5),
      p95Ms: percentile(mountDurations, 0.95),
    },
    updateAndCommit: {
      p50Ms: percentile(updateDurations, 0.5),
      p95Ms: percentile(updateDurations, 0.95),
    },
  };
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const output = resolve(
    currentDirectory,
    "../benchmark-results/chromium.json",
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  expect(report.updateAndCommit.p95Ms).toBeLessThanOrEqual(16.7);
});
