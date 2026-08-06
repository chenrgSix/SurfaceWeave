import { DynamicUIError, cloneValue } from "@surfaceweave/core";
import type { PreferenceDocument, PreferencePatch } from "@surfaceweave/core";
import type { StorageAdapter } from "@surfaceweave/storage";

import { parsePreferenceDocument, parsePreferencePatch } from "./validation.js";

/** Hydrated preference cache with persist-before-publish mutation semantics. */
export class PreferenceRepository {
  readonly #adapter: StorageAdapter<PreferenceDocument>;
  #document: PreferenceDocument = { version: 1, patches: [] };
  #hydrated = false;

  constructor(adapter: StorageAdapter<PreferenceDocument>) {
    this.#adapter = adapter;
  }

  async hydrate(): Promise<void> {
    const stored = await this.#adapter.load();
    this.#document =
      stored === undefined
        ? { version: 1, patches: [] }
        : parsePreferenceDocument(stored);
    this.#hydrated = true;
  }

  isHydrated(): boolean {
    return this.#hydrated;
  }

  list(): PreferencePatch[] {
    this.#assertHydrated();
    return cloneValue(this.#document.patches).sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  }

  get(id: string): PreferencePatch | undefined {
    return this.list().find((patch) => patch.id === id);
  }

  async upsert(input: PreferencePatch): Promise<PreferencePatch> {
    this.#assertHydrated();
    const patch = parsePreferencePatch(input);
    const candidate = this.list().filter((item) => item.id !== patch.id);
    candidate.push(patch);
    const document: PreferenceDocument = {
      version: 1,
      patches: candidate.sort((left, right) => left.id.localeCompare(right.id)),
    };
    await this.#adapter.save(document);
    this.#document = document;
    return cloneValue(patch);
  }

  async remove(id: string): Promise<void> {
    this.#assertHydrated();
    if (!this.#document.patches.some((patch) => patch.id === id)) {
      throw new DynamicUIError(
        "PREFERENCE_NOT_FOUND",
        `Preference "${id}" does not exist`,
      );
    }
    const document: PreferenceDocument = {
      version: 1,
      patches: this.#document.patches.filter((patch) => patch.id !== id),
    };
    await this.#adapter.save(document);
    this.#document = document;
  }

  #assertHydrated(): void {
    if (!this.#hydrated) {
      throw new DynamicUIError(
        "PREFERENCES_NOT_HYDRATED",
        "PreferenceRepository.hydrate() must complete before use",
      );
    }
  }
}
