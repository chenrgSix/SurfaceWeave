import { describe, expect, it } from "vitest";

import {
  InMemorySurfaceStore,
  cloneValue,
  validateSurface,
  writeDataPath,
} from "../src/index.js";
import type { DataChange, Surface } from "../src/index.js";
import { createFormSurface, createRegistry } from "./fixtures.js";

function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("InMemorySurfaceStore differential behavior", () => {
  it("matches the clone-and-mutate reference across deterministic batches", () => {
    const registry = createRegistry();
    const store = new InMemorySurfaceStore(registry);
    let actual = store.createSurface(createFormSurface());
    let reference: Surface = cloneValue(actual);
    const events: number[] = [];
    store.subscribe(actual.id, (event) => events.push(event.sequence));
    const random = pseudoRandom(0x5face);

    for (let iteration = 0; iteration < 100; iteration += 1) {
      const changes: DataChange[] = [
        random() < 0.5
          ? { path: "purchase.name", value: `name-${iteration}` }
          : { path: "purchase.remark", value: `remark-${iteration}` },
      ];
      if (random() < 0.25) {
        changes.push({
          path: "purchase.remark",
          value: `batch-${iteration}`,
        });
      }

      const expected = cloneValue(reference);
      for (const change of changes) {
        writeDataPath(expected.data, change.path, change.value);
      }
      validateSurface(expected, registry);
      expected.revision = reference.revision + 1;

      actual = store.updateData(actual.id, actual.revision, changes);
      expect(actual).toEqual(expected);
      expect(store.requireSurface(actual.id)).toEqual(expected);
      reference = expected;
    }

    expect(events).toEqual(
      Array.from({ length: 100 }, (_value, index) => index + 2),
    );
  });
});
