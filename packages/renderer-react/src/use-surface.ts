import type { Surface, SurfaceStore } from "@package-first/core";
import { useEffect, useState } from "react";

/** React subscription adapter; multiple views receive the same committed Store state. */
export function useSurface(store: SurfaceStore, surfaceId: string): Surface {
  const [surface, setSurface] = useState(() => store.requireSurface(surfaceId));

  useEffect(() => {
    setSurface(store.requireSurface(surfaceId));
    return store.subscribe(surfaceId, (_event, next) => {
      setSurface(next);
    });
  }, [store, surfaceId]);

  return surface;
}
