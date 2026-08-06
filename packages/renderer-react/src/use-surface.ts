import type { Surface, SurfaceStore } from "@surfaceweave/core";
import { useEffect, useState } from "react";

/** React subscription adapter; multiple views receive the same committed Store state. */
export function useSurface(store: SurfaceStore, surfaceId: string): Surface {
  const [snapshot, setSnapshot] = useState(() => ({
    surfaceId,
    surface: store.requireSurface(surfaceId),
  }));
  const surface =
    snapshot.surfaceId === surfaceId
      ? snapshot.surface
      : store.requireSurface(surfaceId);

  useEffect(() => {
    setSnapshot({ surfaceId, surface: store.requireSurface(surfaceId) });
    return store.subscribe(surfaceId, (_event, next) => {
      setSnapshot({ surfaceId, surface: next });
    });
  }, [store, surfaceId]);

  return surface;
}
