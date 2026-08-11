import {
  cloneValue,
  getSurfaceObservationSource,
  readDataPath,
  walkNodes,
  writeDataPathImmutable,
} from "@surfaceweave/core";
import type {
  JsonValue,
  Surface,
  SurfaceObservationEvent,
  SurfaceObservationSource,
  SurfaceStore,
  UINode,
} from "@surfaceweave/core";

export interface SurfaceNodeSnapshot {
  node: UINode | undefined;
  value: JsonValue | undefined;
}

type Listener = () => void;

function mutableSurface<T>(value: T): Surface {
  return cloneValue(value) as unknown as Surface;
}

function pathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}.`) ||
    right.startsWith(`${left}.`)
  );
}

/** Per-view normalized read model with a legacy SurfaceStore fallback. */
export class SurfaceReadModel {
  readonly #store: SurfaceStore;
  readonly #surfaceId: string;
  readonly #observation: SurfaceObservationSource | undefined;
  readonly #surfaceListeners = new Set<Listener>();
  readonly #nodeListeners = new Map<string, Set<Listener>>();
  readonly #nodeSnapshots = new Map<string, SurfaceNodeSnapshot>();
  readonly #nodesById = new Map<string, UINode>();
  readonly #bindingNodes = new Map<string, string[]>();
  #surface: Surface;
  #unsubscribeStore: (() => void) | undefined;
  #subscriptionCount = 0;

  constructor(store: SurfaceStore, surfaceId: string) {
    this.#store = store;
    this.#surfaceId = surfaceId;
    this.#observation = getSurfaceObservationSource(store);
    this.#surface = this.#readCurrentSurface();
    this.#rebuildNodeState();
  }

  readonly getSurface = (): Surface => this.#surface;

  getNodeSnapshot(nodeId: string): SurfaceNodeSnapshot {
    const existing = this.#nodeSnapshots.get(nodeId);
    if (existing !== undefined) return existing;
    const created = this.#createNodeSnapshot(nodeId);
    this.#nodeSnapshots.set(nodeId, created);
    return created;
  }

  readonly subscribeSurface = (listener: Listener): (() => void) =>
    this.#subscribe(this.#surfaceListeners, listener);

  subscribeNode(nodeId: string, listener: Listener): () => void {
    const listeners = this.#nodeListeners.get(nodeId) ?? new Set<Listener>();
    this.#nodeListeners.set(nodeId, listeners);
    return this.#subscribe(listeners, listener, () => {
      if (listeners.size === 0) this.#nodeListeners.delete(nodeId);
    });
  }

  #subscribe(
    listeners: Set<Listener>,
    listener: Listener,
    afterUnsubscribe?: () => void,
  ): () => void {
    listeners.add(listener);
    this.#subscriptionCount += 1;
    if (this.#subscriptionCount === 1) this.#connect();
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      listeners.delete(listener);
      afterUnsubscribe?.();
      this.#subscriptionCount -= 1;
      if (this.#subscriptionCount === 0) this.#disconnect();
    };
  }

  #connect(): void {
    this.#unsubscribeStore =
      this.#observation === undefined
        ? this.#store.subscribe(this.#surfaceId, (event, surface) =>
            this.#handleEvent(event, surface),
          )
        : this.#observation.subscribe(this.#surfaceId, (event) =>
            this.#handleEvent(event),
          );
    const current = this.#readCurrentSurface();
    if (current.revision !== this.#surface.revision) {
      this.#replaceSurface(current);
    }
  }

  #disconnect(): void {
    this.#unsubscribeStore?.();
    this.#unsubscribeStore = undefined;
  }

  #readCurrentSurface(): Surface {
    return this.#observation === undefined
      ? this.#store.requireSurface(this.#surfaceId)
      : mutableSurface(this.#observation.getSnapshot(this.#surfaceId));
  }

  #handleEvent(event: SurfaceObservationEvent, legacySurface?: Surface): void {
    if (
      event.type === "surface.dataChanged" &&
      event.revision === this.#surface.revision + 1
    ) {
      let data = this.#surface.data;
      for (const change of event.changes) {
        data = writeDataPathImmutable(
          data,
          change.path,
          cloneValue(change.value) as JsonValue,
        );
      }
      this.#surface = { ...this.#surface, revision: event.revision, data };
      const affected =
        this.#observation?.selectAffectedNodeIds(
          this.#surfaceId,
          event.changes.map((change) => change.path),
        ) ??
        this.#selectFallbackNodes(event.changes.map((change) => change.path));
      for (const nodeId of affected) {
        this.#nodeSnapshots.set(nodeId, this.#createNodeSnapshot(nodeId));
      }
      this.#notify(this.#surfaceListeners);
      for (const nodeId of affected) {
        this.#notify(this.#nodeListeners.get(nodeId));
      }
      return;
    }
    const next =
      legacySurface === undefined ? this.#readCurrentSurface() : legacySurface;
    this.#replaceSurface(next);
  }

  #replaceSurface(surface: Surface): void {
    this.#surface = mutableSurface(surface);
    this.#rebuildNodeState();
    this.#notify(this.#surfaceListeners);
    for (const listeners of this.#nodeListeners.values()) {
      this.#notify(listeners);
    }
  }

  #rebuildNodeState(): void {
    this.#nodesById.clear();
    this.#bindingNodes.clear();
    walkNodes(this.#surface.tree, (node) => {
      this.#nodesById.set(node.id, node);
      if (node.binding !== undefined) {
        const nodeIds = this.#bindingNodes.get(node.binding.path) ?? [];
        nodeIds.push(node.id);
        this.#bindingNodes.set(node.binding.path, nodeIds);
      }
    });
    const knownNodeIds = new Set([
      ...this.#nodeSnapshots.keys(),
      ...this.#nodeListeners.keys(),
      ...this.#nodesById.keys(),
    ]);
    for (const nodeId of knownNodeIds) {
      this.#nodeSnapshots.set(nodeId, this.#createNodeSnapshot(nodeId));
    }
  }

  #createNodeSnapshot(nodeId: string): SurfaceNodeSnapshot {
    const node = this.#nodesById.get(nodeId);
    return {
      node,
      value:
        node?.binding === undefined
          ? undefined
          : readDataPath(this.#surface.data, node.binding.path),
    };
  }

  #selectFallbackNodes(changedPaths: readonly string[]): string[] {
    const affected = new Set<string>();
    for (const [bindingPath, nodeIds] of this.#bindingNodes) {
      if (!changedPaths.some((path) => pathsOverlap(path, bindingPath))) {
        continue;
      }
      for (const nodeId of nodeIds) affected.add(nodeId);
    }
    return [...affected];
  }

  #notify(listeners: Set<Listener> | undefined): void {
    for (const listener of listeners ?? []) listener();
  }
}
