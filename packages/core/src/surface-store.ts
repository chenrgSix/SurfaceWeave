import {
  bindingValueTypeMatches,
  cloneValue,
  deepFreezeValue,
  writeDataPathImmutable,
} from "./data.js";
import { migrateSurfaceData } from "./data-migration.js";
import { DynamicUIError } from "./errors.js";
import { applyOperationsToSurface, validateSurface } from "./operations.js";
import {
  createSurfaceResourcePolicySummary,
  resolveSurfaceResourcePolicy,
} from "./resource-limits.js";
import {
  buildSurfaceIndex,
  findAffectedBindingNodeIds,
} from "./surface-index.js";
import { surfaceObservation } from "./surface-observation.js";
import type { SurfaceResourcePolicySummary } from "./client-capabilities.js";
import type { SurfaceIndex } from "./surface-index.js";
import type {
  SurfaceObservationListener,
  SurfaceObservationSource,
  SurfaceSnapshot,
} from "./surface-observation.js";
import type {
  ComponentRegistry,
  DataChange,
  Surface,
  SurfaceEvent,
  SurfaceListener,
  SurfaceResourceLimits,
  SurfaceResourcePolicy,
  SurfaceStore,
  UIOperation,
} from "./types.js";

type SurfaceInput = Omit<Surface, "revision"> & { revision?: number };
type SurfaceReplacement = Omit<Surface, "id" | "revision">;

interface StoredSurface {
  surface: Surface;
  index: SurfaceIndex;
}

export type SurfaceListenerErrorHandler = (
  error: unknown,
  event: SurfaceEvent,
  surface: Surface,
) => void;

export interface InMemorySurfaceStoreOptions {
  resourcePolicy?: Partial<SurfaceResourcePolicy>;
  /** @deprecated Use resourcePolicy. */
  limits?: Partial<SurfaceResourceLimits>;
  onListenerError?: SurfaceListenerErrorHandler;
}

function assertRevision(surface: Surface, baseRevision: number): void {
  if (surface.revision !== baseRevision) {
    throw new DynamicUIError(
      "REVISION_CONFLICT",
      `Surface "${surface.id}" is at revision ${surface.revision}, not ${baseRevision}`,
      { expected: baseRevision, actual: surface.revision },
    );
  }
}

/** Framework-independent in-memory state owner with optimistic concurrency. */
export class InMemorySurfaceStore implements SurfaceStore {
  readonly #registry: ComponentRegistry;
  readonly #surfaces = new Map<string, StoredSurface>();
  readonly #listeners = new Map<string, Set<SurfaceListener>>();
  readonly #observationListeners = new Map<
    string,
    Set<SurfaceObservationListener>
  >();
  readonly #resourcePolicy: SurfaceResourcePolicy | undefined;
  readonly #onListenerError: SurfaceListenerErrorHandler | undefined;
  #sequence = 0;

  readonly [surfaceObservation]: SurfaceObservationSource = {
    getSnapshot: (surfaceId) =>
      this.#current(surfaceId).surface as SurfaceSnapshot,
    selectAffectedNodeIds: (surfaceId, changedPaths) =>
      findAffectedBindingNodeIds(this.#current(surfaceId).index, changedPaths),
    subscribe: (surfaceId, listener) =>
      this.#subscribeToObservations(surfaceId, listener),
  };

  constructor(
    registry: ComponentRegistry,
    options: InMemorySurfaceStoreOptions = {},
  ) {
    this.#registry = registry;
    if (options.resourcePolicy !== undefined && options.limits !== undefined) {
      throw new DynamicUIError(
        "INVALID_RESOURCE_POLICY",
        "Configure either resourcePolicy or deprecated limits, not both",
      );
    }
    const configured = options.resourcePolicy ?? options.limits;
    this.#resourcePolicy =
      configured === undefined
        ? undefined
        : resolveSurfaceResourcePolicy(configured);
    this.#onListenerError = options.onListenerError;
  }

  createSurface(input: SurfaceInput): Surface {
    if (this.#surfaces.has(input.id)) {
      throw new DynamicUIError(
        "SURFACE_EXISTS",
        `Surface "${input.id}" already exists`,
      );
    }
    const candidate: Surface = {
      ...input,
      revision: 0,
    };
    validateSurface(candidate, this.#registry, this.#resourcePolicy);
    const surface = cloneValue(candidate);
    this.#commit(surface);
    this.#publish(surface.id, {
      type: "surface.created",
      sequence: this.#nextSequence(),
      surfaceId: surface.id,
      revision: surface.revision,
      surface: cloneValue(surface),
    });
    return cloneValue(surface);
  }

  getSurface(surfaceId: string): Surface | undefined {
    const stored = this.#surfaces.get(surfaceId);
    return stored === undefined ? undefined : cloneValue(stored.surface);
  }

  requireSurface(surfaceId: string): Surface {
    const stored = this.#surfaces.get(surfaceId);
    if (stored === undefined) {
      throw new DynamicUIError(
        "SURFACE_NOT_FOUND",
        `Surface "${surfaceId}" does not exist`,
        { surfaceId },
      );
    }
    return cloneValue(stored.surface);
  }

  subscribe(surfaceId: string, listener: SurfaceListener): () => void {
    const listeners =
      this.#listeners.get(surfaceId) ?? new Set<SurfaceListener>();
    listeners.add(listener);
    this.#listeners.set(surfaceId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.#listeners.delete(surfaceId);
      }
    };
  }

  applyOperations(
    surfaceId: string,
    baseRevision: number,
    operations: UIOperation[],
  ): Surface {
    const current = this.#current(surfaceId).surface;
    assertRevision(current, baseRevision);
    const next = applyOperationsToSurface(
      current,
      operations,
      this.#registry,
      this.#resourcePolicy,
    );
    next.revision = current.revision + 1;
    this.#commit(next);
    this.#publish(surfaceId, {
      type: "surface.operationsApplied",
      sequence: this.#nextSequence(),
      surfaceId,
      revision: next.revision,
      operations: cloneValue(operations),
    });
    return cloneValue(next);
  }

  updateData(
    surfaceId: string,
    baseRevision: number,
    changes: DataChange[],
  ): Surface {
    if (changes.length === 0) {
      throw new DynamicUIError(
        "INVALID_OPERATION",
        "At least one data change is required",
      );
    }
    const stored = this.#current(surfaceId);
    const { surface: current, index } = stored;
    assertRevision(current, baseRevision);
    let data = current.data;
    for (const change of changes) {
      const bindings = index.bindingsByPath.get(change.path);
      if (bindings === undefined) {
        throw new DynamicUIError(
          "INVALID_OPERATION",
          `Data path "${change.path}" is not bound by the surface`,
        );
      }
      for (const { binding } of bindings) {
        if (!bindingValueTypeMatches(binding.valueType, change.value)) {
          throw new DynamicUIError(
            "INVALID_OPERATION",
            `Data at "${change.path}" is incompatible with ${binding.valueType} binding`,
          );
        }
      }
      data = writeDataPathImmutable(data, change.path, change.value);
    }
    const next: Surface = { ...current, data };
    validateSurface(next, this.#registry, this.#resourcePolicy);
    next.revision = current.revision + 1;
    this.#commit(next, index);
    this.#publish(surfaceId, {
      type: "surface.dataChanged",
      sequence: this.#nextSequence(),
      surfaceId,
      revision: next.revision,
      changes: cloneValue(changes),
    });
    return cloneValue(next);
  }

  replaceSurface(
    surfaceId: string,
    baseRevision: number,
    replacement: SurfaceReplacement,
  ): Surface {
    const current = this.#current(surfaceId).surface;
    assertRevision(current, baseRevision);
    const candidate: Surface = {
      ...replacement,
      id: surfaceId,
      revision: current.revision + 1,
    };
    validateSurface(candidate, this.#registry, this.#resourcePolicy);
    const next = cloneValue(candidate);
    const migrated = migrateSurfaceData(current, next);
    next.data = migrated.surface.data;
    validateSurface(next, this.#registry, this.#resourcePolicy);
    this.#commit(next);
    this.#publish(surfaceId, {
      type: "surface.replaced",
      sequence: this.#nextSequence(),
      surfaceId,
      revision: next.revision,
      previousRevision: current.revision,
      surface: cloneValue(next),
    });
    return cloneValue(next);
  }

  #current(surfaceId: string): StoredSurface {
    const stored = this.#surfaces.get(surfaceId);
    if (stored === undefined) {
      throw new DynamicUIError(
        "SURFACE_NOT_FOUND",
        `Surface "${surfaceId}" does not exist`,
        { surfaceId },
      );
    }
    return stored;
  }

  #commit(surface: Surface, index = buildSurfaceIndex(surface)): void {
    const committed = deepFreezeValue(surface) as Surface;
    this.#surfaces.set(surface.id, { surface: committed, index });
  }

  #subscribeToObservations(
    surfaceId: string,
    listener: SurfaceObservationListener,
  ): () => void {
    const listeners =
      this.#observationListeners.get(surfaceId) ??
      new Set<SurfaceObservationListener>();
    listeners.add(listener);
    this.#observationListeners.set(surfaceId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.#observationListeners.delete(surfaceId);
      }
    };
  }

  getResourcePolicySummary(): SurfaceResourcePolicySummary {
    return createSurfaceResourcePolicySummary(this.#resourcePolicy);
  }

  #nextSequence(): number {
    this.#sequence += 1;
    return this.#sequence;
  }

  #publish(surfaceId: string, event: SurfaceEvent): void {
    const stored = this.#surfaces.get(surfaceId);
    if (stored === undefined) {
      return;
    }
    const { surface } = stored;
    const observationEvent = deepFreezeValue(event);
    for (const listener of this.#listeners.get(surfaceId) ?? []) {
      try {
        listener(cloneValue(event), cloneValue(surface));
      } catch (error) {
        try {
          this.#onListenerError?.(
            error,
            cloneValue(event),
            cloneValue(surface),
          );
        } catch {
          // Observer error reporting must never change committed Store state.
        }
      }
    }
    for (const listener of this.#observationListeners.get(surfaceId) ?? []) {
      try {
        listener(observationEvent);
      } catch (error) {
        try {
          this.#onListenerError?.(
            error,
            cloneValue(event),
            cloneValue(surface),
          );
        } catch {
          // Observer error reporting must never change committed Store state.
        }
      }
    }
  }

  /** Releases every in-memory Surface and subscription owned by this Store. */
  dispose(): void {
    this.#listeners.clear();
    this.#observationListeners.clear();
    this.#surfaces.clear();
  }
}
