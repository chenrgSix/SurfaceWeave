import {
  bindingValueTypeMatches,
  cloneValue,
  walkNodes,
  writeDataPath,
} from "./data.js";
import { migrateSurfaceData } from "./data-migration.js";
import { DynamicUIError } from "./errors.js";
import { applyOperationsToSurface, validateSurface } from "./operations.js";
import type {
  ComponentRegistry,
  DataBinding,
  DataChange,
  Surface,
  SurfaceEvent,
  SurfaceListener,
  SurfaceStore,
  UIOperation,
} from "./types.js";

type SurfaceInput = Omit<Surface, "revision"> & { revision?: number };
type SurfaceReplacement = Omit<Surface, "id" | "revision">;

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
  #sequence = 0;

  constructor(registry: ComponentRegistry) {
    this.#registry = registry;
  }

  createSurface(input: SurfaceInput): Surface {
    if (this.#surfaces.has(input.id)) {
      throw new DynamicUIError(
        "SURFACE_EXISTS",
        `Surface "${input.id}" already exists`,
      );
    }
    const surface: Surface = {
      ...cloneValue(input),
      revision: 0,
    };
    validateSurface(surface, this.#registry);
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
    const next = applyOperationsToSurface(current, operations, this.#registry);
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
    const next: Surface = {
      ...cloneValue(replacement),
      id: surfaceId,
      revision: current.revision + 1,
    };
    validateSurface(next, this.#registry);
    const migrated = migrateSurfaceData(current, next);
    next.data = migrated.surface.data;
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
      listener(cloneValue(event), cloneValue(surface));
    }
  }
}
