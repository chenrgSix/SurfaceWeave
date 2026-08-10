import {
  bindingValueTypeMatches,
  cloneValue,
  walkNodes,
  writeDataPath,
} from "./data.js";
import { migrateSurfaceData } from "./data-migration.js";
import { DynamicUIError } from "./errors.js";
import { applyOperationsToSurface, validateSurface } from "./operations.js";
import {
  createSurfaceResourcePolicySummary,
  resolveSurfaceResourcePolicy,
} from "./resource-limits.js";
import type { SurfaceResourcePolicySummary } from "./client-capabilities.js";
import type {
  ComponentRegistry,
  DataBinding,
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
  readonly #surfaces = new Map<string, Surface>();
  readonly #listeners = new Map<string, Set<SurfaceListener>>();
  readonly #resourcePolicy: SurfaceResourcePolicy | undefined;
  readonly #onListenerError: SurfaceListenerErrorHandler | undefined;
  #sequence = 0;

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
    this.#surfaces.set(surface.id, surface);
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
    const surface = this.#surfaces.get(surfaceId);
    return surface === undefined ? undefined : cloneValue(surface);
  }

  requireSurface(surfaceId: string): Surface {
    const surface = this.#surfaces.get(surfaceId);
    if (surface === undefined) {
      throw new DynamicUIError(
        "SURFACE_NOT_FOUND",
        `Surface "${surfaceId}" does not exist`,
        { surfaceId },
      );
    }
    return cloneValue(surface);
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
    const current = this.#current(surfaceId);
    assertRevision(current, baseRevision);
    const next = applyOperationsToSurface(
      current,
      operations,
      this.#registry,
      this.#resourcePolicy,
    );
    next.revision = current.revision + 1;
    this.#surfaces.set(surfaceId, next);
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
    const current = this.#current(surfaceId);
    assertRevision(current, baseRevision);
    const boundPaths = new Map<string, DataBinding>();
    walkNodes(current.tree, (node) => {
      if (node.binding !== undefined) {
        boundPaths.set(node.binding.path, node.binding);
      }
    });
    const next = cloneValue(current);
    for (const change of changes) {
      const binding = boundPaths.get(change.path);
      if (binding === undefined) {
        throw new DynamicUIError(
          "INVALID_OPERATION",
          `Data path "${change.path}" is not bound by the surface`,
        );
      }
      if (!bindingValueTypeMatches(binding.valueType, change.value)) {
        throw new DynamicUIError(
          "INVALID_OPERATION",
          `Data at "${change.path}" is incompatible with ${binding.valueType} binding`,
        );
      }
      writeDataPath(next.data, change.path, change.value);
    }
    validateSurface(next, this.#registry, this.#resourcePolicy);
    next.revision = current.revision + 1;
    this.#surfaces.set(surfaceId, next);
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
    const current = this.#current(surfaceId);
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
    this.#surfaces.set(surfaceId, next);
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

  #current(surfaceId: string): Surface {
    const surface = this.#surfaces.get(surfaceId);
    if (surface === undefined) {
      throw new DynamicUIError(
        "SURFACE_NOT_FOUND",
        `Surface "${surfaceId}" does not exist`,
        { surfaceId },
      );
    }
    return surface;
  }

  getResourcePolicySummary(): SurfaceResourcePolicySummary {
    return createSurfaceResourcePolicySummary(this.#resourcePolicy);
  }

  #nextSequence(): number {
    this.#sequence += 1;
    return this.#sequence;
  }

  #publish(surfaceId: string, event: SurfaceEvent): void {
    const surface = this.#surfaces.get(surfaceId);
    if (surface === undefined) {
      return;
    }
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
  }

  /** Releases every in-memory Surface and subscription owned by this Store. */
  dispose(): void {
    this.#listeners.clear();
    this.#surfaces.clear();
  }
}
