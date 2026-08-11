import {
  InMemorySurfaceStore,
  cloneValue,
  createStandardComponentRegistry,
  recommendedSurfaceResourcePolicy,
  validateSurface,
  walkNodes,
} from "../../packages/core/dist/index.js";

import {
  measureSync,
  printBenchmarkReport,
  readBenchmarkOptions,
  runtimeMetadata,
} from "./benchmark-utils.mjs";
import {
  createDeepFormSurface,
  createFlatFormSurface,
} from "./surface-fixtures.mjs";

function sampleCount(nodeCount, smoke) {
  if (smoke) return 2;
  if (nodeCount >= 2_000) return 12;
  if (nodeCount >= 500) return 20;
  return 40;
}

function benchmarkUpdate(nodeCount, listenerCount, smoke) {
  const registry = createStandardComponentRegistry();
  const store = new InMemorySurfaceStore(registry, {
    resourcePolicy: recommendedSurfaceResourcePolicy,
  });
  let surface = store.createSurface(
    createFlatFormSurface(nodeCount, `update-${nodeCount}-${listenerCount}`),
  );
  for (let index = 0; index < listenerCount; index += 1) {
    store.subscribe(surface.id, () => {});
  }
  let valueSequence = 0;
  return measureSync(
    () => {
      valueSequence += 1;
      surface = store.updateData(surface.id, surface.revision, [
        { path: "fields.field0", value: `value-${valueSequence}` },
      ]);
    },
    {
      samples: sampleCount(nodeCount, smoke),
      warmups: smoke ? 1 : 3,
    },
  );
}

const options = readBenchmarkOptions();
const sizes = options.sizes ?? (options.smoke ? [50] : [50, 500, 2_000]);
const listenerCounts = options.listeners ?? (options.smoke ? [0] : [0, 1, 5]);
const registry = createStandardComponentRegistry();
const scenarios = [];

for (const nodeCount of sizes) {
  const surface = {
    ...createFlatFormSurface(nodeCount),
    revision: 0,
  };
  const samples = sampleCount(nodeCount, options.smoke);
  const metrics = {
    walkNodes: measureSync(() => walkNodes(surface.tree, () => {}), {
      samples,
      warmups: 3,
      operationsPerSample: options.smoke ? 5 : 100,
    }),
    cloneSurface: measureSync(() => cloneValue(surface), {
      samples,
      warmups: 3,
    }),
    validateSurface: measureSync(
      () =>
        validateSurface(surface, registry, recommendedSurfaceResourcePolicy),
      { samples, warmups: options.smoke ? 1 : 3 },
    ),
  };
  for (const listenerCount of listenerCounts) {
    metrics[`updateData.listeners-${listenerCount}`] = benchmarkUpdate(
      nodeCount,
      listenerCount,
      options.smoke,
    );
  }
  scenarios.push({ name: `flat-${nodeCount}`, metrics });
}

const deep = {
  ...createDeepFormSurface(64),
  revision: 0,
};
const deepResourcePolicy = {
  ...recommendedSurfaceResourcePolicy,
  maxJsonDepth: 256,
};
scenarios.push({
  name: "depth-64.max-json-depth-256",
  metrics: {
    validateSurface: measureSync(
      () => validateSurface(deep, registry, deepResourcePolicy),
      { samples: options.smoke ? 2 : 20, warmups: options.smoke ? 1 : 3 },
    ),
  },
});

printBenchmarkReport(
  {
    name: "SurfaceWeave Core Surface benchmark",
    runtime: runtimeMetadata(),
    policy: recommendedSurfaceResourcePolicy,
    scenarios,
  },
  options,
);
