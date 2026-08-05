import { StorageAdapterError, type StorageValueParser } from "./types.js";

export function encodeStorageValue<T>(value: T): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new StorageAdapterError(
      "STORAGE_WRITE_FAILED",
      "Storage value is not JSON serializable",
      error,
    );
  }
}

export function decodeStorageValue<T>(
  serialized: string,
  parser: StorageValueParser<T>,
): T {
  try {
    return parser(JSON.parse(serialized) as unknown);
  } catch (error) {
    if (error instanceof StorageAdapterError) {
      throw error;
    }
    throw new StorageAdapterError(
      "STORAGE_INVALID_DATA",
      "Stored JSON does not match the expected document shape",
      error,
    );
  }
}
