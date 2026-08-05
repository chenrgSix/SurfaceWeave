import { decodeStorageValue, encodeStorageValue } from "./codec.js";
import {
  StorageAdapterError,
  type LocalStorageLike,
  type StorageAdapter,
  type StorageValueParser,
} from "./types.js";

/** JSON adapter over browser LocalStorage or a compatible injected implementation. */
export class LocalStorageAdapter<T> implements StorageAdapter<T> {
  readonly #key: string;
  readonly #parser: StorageValueParser<T>;
  readonly #storage: LocalStorageLike;

  constructor(
    key: string,
    parser: StorageValueParser<T>,
    storage: LocalStorageLike = globalThis.localStorage,
  ) {
    this.#key = key;
    this.#parser = parser;
    this.#storage = storage;
  }

  async load(): Promise<T | undefined> {
    try {
      const serialized = this.#storage.getItem(this.#key);
      return serialized === null
        ? undefined
        : decodeStorageValue(serialized, this.#parser);
    } catch (error) {
      if (error instanceof StorageAdapterError) {
        throw error;
      }
      throw new StorageAdapterError(
        "STORAGE_READ_FAILED",
        `Unable to read LocalStorage key "${this.#key}"`,
        error,
      );
    }
  }

  async save(value: T): Promise<void> {
    try {
      this.#storage.setItem(this.#key, encodeStorageValue(value));
    } catch (error) {
      if (error instanceof StorageAdapterError) {
        throw error;
      }
      throw new StorageAdapterError(
        "STORAGE_WRITE_FAILED",
        `Unable to write LocalStorage key "${this.#key}"`,
        error,
      );
    }
  }

  async clear(): Promise<void> {
    try {
      this.#storage.removeItem(this.#key);
    } catch (error) {
      throw new StorageAdapterError(
        "STORAGE_CLEAR_FAILED",
        `Unable to clear LocalStorage key "${this.#key}"`,
        error,
      );
    }
  }
}
