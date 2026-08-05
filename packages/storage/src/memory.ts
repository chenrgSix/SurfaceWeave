import type { StorageAdapter } from "./types.js";

/** Defensive in-memory adapter useful for sessions, tests, and server composition. */
export class MemoryStorageAdapter<T> implements StorageAdapter<T> {
  #value: T | undefined;

  constructor(initialValue?: T) {
    if (initialValue !== undefined) {
      this.#value = structuredClone(initialValue);
    }
  }

  async load(): Promise<T | undefined> {
    return this.#value === undefined ? undefined : structuredClone(this.#value);
  }

  async save(value: T): Promise<void> {
    this.#value = structuredClone(value);
  }

  async clear(): Promise<void> {
    this.#value = undefined;
  }
}
