/** Persistence contract consumed by higher-level repositories. */
export interface StorageAdapter<T> {
  load(): Promise<T | undefined>;
  save(value: T): Promise<void>;
  clear(): Promise<void>;
}

/** Minimal browser-compatible API, injectable for tests and non-window hosts. */
export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Host-provided remote transport. The SDK never chooses an URL or performs fetch. */
export interface BackendStorageTransport {
  read(key: string): Promise<string | undefined>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export type StorageValueParser<T> = (value: unknown) => T;

export type StorageErrorCode =
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "STORAGE_CLEAR_FAILED"
  | "STORAGE_INVALID_DATA";

export class StorageAdapterError extends Error {
  readonly code: StorageErrorCode;
  readonly cause?: unknown;

  constructor(code: StorageErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "StorageAdapterError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
