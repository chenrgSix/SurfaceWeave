import { decodeStorageValue, encodeStorageValue } from "./codec.js";
import {
  StorageAdapterError,
  type BackendStorageTransport,
  type StorageAdapter,
  type StorageValueParser,
} from "./types.js";

/** Delegates persistence to host-owned transport without embedding network behavior. */
export class BackendStorageAdapter<T> implements StorageAdapter<T> {
  readonly #key: string;
  readonly #parser: StorageValueParser<T>;
  readonly #transport: BackendStorageTransport;

  constructor(
    key: string,
    parser: StorageValueParser<T>,
    transport: BackendStorageTransport,
  ) {
    this.#key = key;
    this.#parser = parser;
    this.#transport = transport;
  }

  async load(): Promise<T | undefined> {
    try {
      const serialized = await this.#transport.read(this.#key);
      return serialized === undefined
        ? undefined
        : decodeStorageValue(serialized, this.#parser);
    } catch (error) {
      if (error instanceof StorageAdapterError) {
        throw error;
      }
      throw new StorageAdapterError(
        "STORAGE_READ_FAILED",
        `Backend transport failed to read "${this.#key}"`,
        error,
      );
    }
  }

  async save(value: T): Promise<void> {
    try {
      await this.#transport.write(this.#key, encodeStorageValue(value));
    } catch (error) {
      if (error instanceof StorageAdapterError) {
        throw error;
      }
      throw new StorageAdapterError(
        "STORAGE_WRITE_FAILED",
        `Backend transport failed to write "${this.#key}"`,
        error,
      );
    }
  }

  async clear(): Promise<void> {
    try {
      await this.#transport.remove(this.#key);
    } catch (error) {
      throw new StorageAdapterError(
        "STORAGE_CLEAR_FAILED",
        `Backend transport failed to clear "${this.#key}"`,
        error,
      );
    }
  }
}
