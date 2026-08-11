import type {
  DeepReadonly,
  Surface,
  SurfaceEvent,
  SurfaceStore,
} from "./types.js";

export type SurfaceSnapshot = DeepReadonly<Surface>;
export type SurfaceObservationEvent = DeepReadonly<SurfaceEvent>;
export type SurfaceObservationListener = (
  event: SurfaceObservationEvent,
) => void;

/** Immutable, event-only capability implemented separately from SurfaceStore. */
export interface SurfaceObservationSource {
  getSnapshot(surfaceId: string): SurfaceSnapshot;
  selectAffectedNodeIds(
    surfaceId: string,
    changedPaths: readonly string[],
  ): readonly string[];
  subscribe(
    surfaceId: string,
    listener: SurfaceObservationListener,
  ): () => void;
}

export const surfaceObservation: unique symbol = Symbol.for(
  "@surfaceweave/core.surface-observation",
) as never;

export interface SurfaceObservationProvider {
  readonly [surfaceObservation]: SurfaceObservationSource;
}

/** Detects the optional capability without widening the stable Store contract. */
export function getSurfaceObservationSource(
  store: SurfaceStore,
): SurfaceObservationSource | undefined {
  const source = (store as Partial<SurfaceObservationProvider>)[
    surfaceObservation
  ];
  return source !== undefined &&
    typeof source.getSnapshot === "function" &&
    typeof source.selectAffectedNodeIds === "function" &&
    typeof source.subscribe === "function"
    ? source
    : undefined;
}
