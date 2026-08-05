import { describe, expect, it, vi } from "vitest";

import {
  BackendStorageAdapter,
  LocalStorageAdapter,
  MemoryStorageAdapter,
  type BackendStorageTransport,
  type LocalStorageLike,
} from "../src/index.js";

interface Document {
  version: 1;
  ids: string[];
}

function parseDocument(value: unknown): Document {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { version?: unknown }).version !== 1 ||
    !Array.isArray((value as { ids?: unknown }).ids)
  ) {
    throw new Error("Invalid document");
  }
  return value as Document;
}

describe("storage adapters", () => {
  it("keeps defensive memory copies", async () => {
    const adapter = new MemoryStorageAdapter<Document>();
    const input: Document = { version: 1, ids: ["global"] };
    await adapter.save(input);
    input.ids.push("mutated");

    expect(await adapter.load()).toEqual({ version: 1, ids: ["global"] });
  });

  it("persists JSON through an injected LocalStorage implementation", async () => {
    const values = new Map<string, string>();
    const localStorage: LocalStorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const adapter = new LocalStorageAdapter(
      "preferences",
      parseDocument,
      localStorage,
    );

    await adapter.save({ version: 1, ids: ["intent"] });
    expect(await adapter.load()).toEqual({ version: 1, ids: ["intent"] });
    await adapter.clear();
    expect(await adapter.load()).toBeUndefined();
  });

  it("delegates remote persistence to the host transport", async () => {
    const transport: BackendStorageTransport = {
      read: vi.fn(async () => '{"version":1,"ids":["tool"]}'),
      write: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    };
    const adapter = new BackendStorageAdapter(
      "user-42",
      parseDocument,
      transport,
    );

    expect(await adapter.load()).toEqual({ version: 1, ids: ["tool"] });
    await adapter.save({ version: 1, ids: ["tool"] });
    await adapter.clear();

    expect(transport.write).toHaveBeenCalledWith(
      "user-42",
      '{"version":1,"ids":["tool"]}',
    );
    expect(transport.remove).toHaveBeenCalledWith("user-42");
  });

  it.each(["not-json", '{"version":2}'])(
    "reports corrupt or incompatible persisted data with a stable error",
    async (persisted) => {
      const localStorage: LocalStorageLike = {
        getItem: () => persisted,
        setItem: () => undefined,
        removeItem: () => undefined,
      };
      const adapter = new LocalStorageAdapter(
        "preferences",
        parseDocument,
        localStorage,
      );

      await expect(adapter.load()).rejects.toMatchObject({
        code: "STORAGE_INVALID_DATA",
      });
    },
  );
});
