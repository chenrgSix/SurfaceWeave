import type { PreferenceDocument, PreferencePatch } from "@surfaceweave/core";
import { describe, expect, it } from "vitest";

import {
  TauriPreferenceStorage,
  type TauriStoreFactory,
  type TauriStoreLike,
} from "../src/index.js";

class MockTauriStore implements TauriStoreLike {
  readonly values = new Map<string, unknown>();
  saves = 0;

  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.values.get(key)) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async save(): Promise<void> {
    this.saves += 1;
  }
}

function patch(id: string): PreferencePatch {
  return {
    id,
    scope: "global",
    targetStableId: "purchase.remark",
    schemaRef: { id: "purchase", version: "2" },
    operation: {
      type: "setProps",
      target: "purchase.remark",
      props: { collapsed: true },
    },
  };
}

function createStorage(
  store: MockTauriStore,
  userId: string,
): TauriPreferenceStorage {
  const storeFactory: TauriStoreFactory = async () => store;
  return new TauriPreferenceStorage({
    namespace: "tea-purchase",
    userId,
    storeFactory,
  });
}

describe("TauriPreferenceStorage", () => {
  it("reads, writes, lists, and deletes structured preference patches", async () => {
    const store = new MockTauriStore();
    const storage = createStorage(store, "ada");

    await storage.writePreference(patch("collapsed"));

    expect(await storage.readPreference("collapsed")).toEqual(
      patch("collapsed"),
    );
    expect(await storage.listPreferences()).toEqual([patch("collapsed")]);
    expect(await storage.load()).toEqual({
      version: 1,
      patches: [patch("collapsed")],
    });
    expect(await storage.deletePreference("collapsed")).toBe(true);
    expect(await storage.listPreferences()).toEqual([]);
    expect(store.saves).toBe(2);
  });

  it("isolates preference documents by namespace and user", async () => {
    const store = new MockTauriStore();
    const ada = createStorage(store, "ada");
    const grace = createStorage(store, "grace");

    await ada.writePreference(patch("ada-only"));

    expect(ada.key).not.toBe(grace.key);
    expect(await ada.listPreferences()).toHaveLength(1);
    expect(await grace.listPreferences()).toEqual([]);
  });

  it.each(["not-json", JSON.stringify({ version: 2, patches: [] })])(
    "rejects corrupt or incompatible stored documents",
    async (stored) => {
      const store = new MockTauriStore();
      const storage = createStorage(store, "ada");
      store.values.set(storage.key, stored);

      await expect(storage.load()).rejects.toMatchObject({
        code: "STORAGE_INVALID_DATA",
      });
    },
  );

  it("rejects documents that contain session or business data", async () => {
    const store = new MockTauriStore();
    const storage = createStorage(store, "ada");
    const unsafe = {
      version: 1,
      patches: [],
      formData: { cardNumber: "not-for-persistence" },
    } as unknown as PreferenceDocument;

    await expect(storage.save(unsafe)).rejects.toMatchObject({
      code: "STORAGE_INVALID_DATA",
    });
    expect(store.values.size).toBe(0);
  });
});
