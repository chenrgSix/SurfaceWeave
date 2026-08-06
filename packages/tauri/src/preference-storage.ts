import type { PreferenceDocument, PreferencePatch } from "@surfaceweave/core";
import { cloneValue } from "@surfaceweave/core";
import {
  parsePreferenceDocument,
  parsePreferencePatch,
} from "@surfaceweave/preferences";
import {
  StorageAdapterError,
  decodeStorageValue,
  encodeStorageValue,
} from "@surfaceweave/storage";
import type { StorageAdapter } from "@surfaceweave/storage";
import { load as loadTauriStore } from "@tauri-apps/plugin-store";

export interface TauriStoreLike {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  save(): Promise<void>;
}

export type TauriStoreFactory = (path: string) => Promise<TauriStoreLike>;

export interface TauriPreferenceStorageOptions {
  namespace: string;
  userId?: string;
  storePath?: string;
  storeFactory?: TauriStoreFactory;
}

const defaultStoreFactory: TauriStoreFactory = async (path) =>
  loadTauriStore(path, { autoSave: false });

function nonEmpty(value: string, label: string): string {
  if (value.trim() === "") {
    throw new Error(`${label} must be non-empty`);
  }
  return value;
}

/** Tauri Store-backed PreferenceDocument adapter with namespace isolation. */
export class TauriPreferenceStorage implements StorageAdapter<PreferenceDocument> {
  readonly #storeFactory: TauriStoreFactory;
  readonly #storePath: string;
  readonly #key: string;
  #storePromise: Promise<TauriStoreLike> | undefined;
  #mutations: Promise<void> = Promise.resolve();

  constructor(options: TauriPreferenceStorageOptions) {
    const namespace = encodeURIComponent(
      nonEmpty(options.namespace, "Preference namespace"),
    );
    const userId = encodeURIComponent(options.userId ?? "anonymous");
    this.#key = `dynamic-ui:preferences:v1:${namespace}:${userId}`;
    this.#storeFactory = options.storeFactory ?? defaultStoreFactory;
    this.#storePath = options.storePath ?? "dynamic-ui-preferences.json";
  }

  get key(): string {
    return this.#key;
  }

  async load(): Promise<PreferenceDocument | undefined> {
    await this.#mutations;
    return this.#loadDirect();
  }

  async save(value: PreferenceDocument): Promise<void> {
    return this.#enqueue(() => this.#saveDirect(value));
  }

  async clear(): Promise<void> {
    return this.#enqueue(async () => {
      try {
        const store = await this.#storeInstance();
        await store.delete(this.#key);
        await store.save();
      } catch (error) {
        throw new StorageAdapterError(
          "STORAGE_CLEAR_FAILED",
          "Unable to clear Tauri preference storage",
          error,
        );
      }
    });
  }

  async listPreferences(): Promise<PreferencePatch[]> {
    return cloneValue((await this.load())?.patches ?? []);
  }

  async readPreference(id: string): Promise<PreferencePatch | undefined> {
    return (await this.listPreferences()).find((patch) => patch.id === id);
  }

  async writePreference(input: PreferencePatch): Promise<PreferencePatch> {
    const patch = parsePreferencePatch(input);
    return this.#enqueue(async () => {
      const document = (await this.#loadDirect()) ?? {
        version: 1 as const,
        patches: [],
      };
      const patches = document.patches.filter((item) => item.id !== patch.id);
      patches.push(patch);
      await this.#saveDirect({
        version: 1,
        patches: patches.sort((left, right) => left.id.localeCompare(right.id)),
      });
      return cloneValue(patch);
    });
  }

  async deletePreference(id: string): Promise<boolean> {
    return this.#enqueue(async () => {
      const document = await this.#loadDirect();
      if (document === undefined) {
        return false;
      }
      const patches = document.patches.filter((patch) => patch.id !== id);
      if (patches.length === document.patches.length) {
        return false;
      }
      await this.#saveDirect({ version: 1, patches });
      return true;
    });
  }

  async #loadDirect(): Promise<PreferenceDocument | undefined> {
    try {
      const serialized = await (
        await this.#storeInstance()
      ).get<unknown>(this.#key);
      if (serialized === undefined) {
        return undefined;
      }
      if (typeof serialized !== "string") {
        throw new StorageAdapterError(
          "STORAGE_INVALID_DATA",
          "Tauri preference value must use the SDK serialized format",
        );
      }
      return decodeStorageValue(serialized, parsePreferenceDocument);
    } catch (error) {
      if (error instanceof StorageAdapterError) {
        throw error;
      }
      throw new StorageAdapterError(
        "STORAGE_READ_FAILED",
        "Unable to read Tauri preference storage",
        error,
      );
    }
  }

  async #saveDirect(value: PreferenceDocument): Promise<void> {
    let document: PreferenceDocument;
    try {
      document = parsePreferenceDocument(value);
    } catch (error) {
      throw new StorageAdapterError(
        "STORAGE_INVALID_DATA",
        "Preference document is incompatible with schema version 1",
        error,
      );
    }
    try {
      const store = await this.#storeInstance();
      await store.set(this.#key, encodeStorageValue(document));
      await store.save();
    } catch (error) {
      if (error instanceof StorageAdapterError) {
        throw error;
      }
      throw new StorageAdapterError(
        "STORAGE_WRITE_FAILED",
        "Unable to write Tauri preference storage",
        error,
      );
    }
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutations.then(operation);
    this.#mutations = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  #storeInstance(): Promise<TauriStoreLike> {
    this.#storePromise ??= this.#storeFactory(this.#storePath);
    return this.#storePromise;
  }
}
