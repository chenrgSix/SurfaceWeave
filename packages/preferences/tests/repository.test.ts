import type { PreferenceDocument, PreferencePatch } from "@surfaceweave/core";
import { MemoryStorageAdapter } from "@surfaceweave/storage";
import { describe, expect, it, vi } from "vitest";

import { PreferenceRepository } from "../src/index.js";

function patch(id: string): PreferencePatch {
  return {
    id,
    scope: "global",
    targetStableId: id,
    operation: { type: "setProps", target: id, props: { label: id } },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("PreferenceRepository concurrency", () => {
  it("persists every successful concurrent upsert", async () => {
    const adapter = new MemoryStorageAdapter<PreferenceDocument>();
    const repository = new PreferenceRepository(adapter);
    await repository.hydrate();

    const saved = await Promise.all([
      repository.upsert(patch("A")),
      repository.upsert(patch("B")),
    ]);

    expect(saved.map((item) => item.id)).toEqual(["A", "B"]);
    expect(repository.list()).toEqual([patch("A"), patch("B")]);
    expect(await adapter.load()).toEqual({
      version: 1,
      patches: repository.list(),
    });
  });

  it("orders removals with pending inserts without resurrecting deleted preferences", async () => {
    const adapter = new MemoryStorageAdapter<PreferenceDocument>();
    const repository = new PreferenceRepository(adapter);
    await repository.hydrate();

    await Promise.all([
      repository.upsert(patch("A")),
      repository.remove("A"),
      repository.upsert(patch("B")),
    ]);

    expect(repository.list()).toEqual([patch("B")]);
    expect(await adapter.load()).toEqual({ version: 1, patches: [patch("B")] });
  });

  it("does not publish pending or failed writes and continues the queue after failure", async () => {
    const adapter = new MemoryStorageAdapter<PreferenceDocument>();
    const blocked = deferred<void>();
    const started = deferred<void>();
    const save = vi.fn(async (document: PreferenceDocument) => {
      if (document.patches.some((item) => item.id === "A")) {
        started.resolve();
        await blocked.promise;
      }
      await adapter.save(document);
    });
    const repository = new PreferenceRepository({
      load: () => adapter.load(),
      save,
      clear: () => adapter.clear(),
    });
    await repository.hydrate();
    const failed = repository.upsert(patch("A"));
    const successful = repository.upsert(patch("B"));
    const outcomes = Promise.allSettled([failed, successful]);
    await started.promise;
    const pendingCache = repository.list();
    const pendingStored = await adapter.load();
    const failure = new Error("durable write failed");
    blocked.reject(failure);

    expect(await outcomes).toEqual([
      { status: "rejected", reason: failure },
      { status: "fulfilled", value: patch("B") },
    ]);
    expect(pendingCache).toEqual([]);
    expect(pendingStored).toBeUndefined();
    expect(repository.list()).toEqual([patch("B")]);
    expect(await adapter.load()).toEqual({ version: 1, patches: [patch("B")] });
  });

  it("serializes reloads behind pending writes", async () => {
    const adapter = new MemoryStorageAdapter<PreferenceDocument>();
    const blocked = deferred<void>();
    const started = deferred<void>();
    const load = vi.fn(() => adapter.load());
    const repository = new PreferenceRepository({
      load,
      save: async (document) => {
        started.resolve();
        await blocked.promise;
        await adapter.save(document);
      },
      clear: () => adapter.clear(),
    });
    await repository.hydrate();
    const saving = repository.upsert(patch("A"));
    await started.promise;
    const reloading = repository.hydrate();
    await Promise.resolve();
    const readsBeforeCommit = load.mock.calls.length;
    blocked.resolve();
    await Promise.all([saving, reloading]);

    expect(readsBeforeCommit).toBe(1);
    expect(repository.list()).toEqual([patch("A")]);
    expect(await adapter.load()).toEqual({ version: 1, patches: [patch("A")] });
  });
});
