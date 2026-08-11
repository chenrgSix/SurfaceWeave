import { performance } from "node:perf_hooks";

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index] ?? 0;
}

function summarize(samples, operationsPerSample) {
  const normalized = samples
    .map((sample) => sample / operationsPerSample)
    .sort((left, right) => left - right);
  const total = normalized.reduce((sum, sample) => sum + sample, 0);
  return {
    samples: normalized.length,
    operationsPerSample,
    minMs: normalized[0] ?? 0,
    p50Ms: percentile(normalized, 0.5),
    p95Ms: percentile(normalized, 0.95),
    maxMs: normalized.at(-1) ?? 0,
    meanMs: normalized.length === 0 ? 0 : total / normalized.length,
  };
}

export function measureSync(
  operation,
  { samples = 10, warmups = 2, operationsPerSample = 1 } = {},
) {
  for (let index = 0; index < warmups; index += 1) {
    for (
      let operationIndex = 0;
      operationIndex < operationsPerSample;
      operationIndex += 1
    ) {
      operation();
    }
  }
  const durations = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    for (
      let operationIndex = 0;
      operationIndex < operationsPerSample;
      operationIndex += 1
    ) {
      operation();
    }
    durations.push(performance.now() - startedAt);
  }
  return summarize(durations, operationsPerSample);
}

export async function measureAsync(
  operation,
  { samples = 10, warmups = 2, operationsPerSample = 1 } = {},
) {
  for (let index = 0; index < warmups; index += 1) {
    for (
      let operationIndex = 0;
      operationIndex < operationsPerSample;
      operationIndex += 1
    ) {
      await operation();
    }
  }
  const durations = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    for (
      let operationIndex = 0;
      operationIndex < operationsPerSample;
      operationIndex += 1
    ) {
      await operation();
    }
    durations.push(performance.now() - startedAt);
  }
  return summarize(durations, operationsPerSample);
}

export function readBenchmarkOptions(argv = process.argv.slice(2)) {
  const options = {
    json: argv.includes("--json"),
    smoke: argv.includes("--smoke"),
  };
  for (const argument of argv) {
    if (argument.startsWith("--sizes=")) {
      options.sizes = argument
        .slice("--sizes=".length)
        .split(",")
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 2);
    }
    if (argument.startsWith("--listeners=")) {
      options.listeners = argument
        .slice("--listeners=".length)
        .split(",")
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 0);
    }
  }
  return options;
}

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

export function printBenchmarkReport(report, { json = false } = {}) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${report.name}\n`);
  process.stdout.write(
    `runtime=${report.runtime.node} platform=${report.runtime.platform}/${report.runtime.arch}\n`,
  );
  for (const scenario of report.scenarios) {
    process.stdout.write(`\n${scenario.name}\n`);
    for (const [metric, result] of Object.entries(scenario.metrics)) {
      process.stdout.write(
        `  ${metric}: p50=${rounded(result.p50Ms)}ms p95=${rounded(result.p95Ms)}ms mean=${rounded(result.meanMs)}ms\n`,
      );
    }
    if (scenario.renderCounts !== undefined) {
      process.stdout.write(
        `  renders: ${JSON.stringify(scenario.renderCounts)}\n`,
      );
    }
  }
}

export function runtimeMetadata() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}
