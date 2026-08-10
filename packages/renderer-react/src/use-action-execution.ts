import type {
  ActionExecutionSnapshot,
  ActionExecutionStateSource,
} from "@surfaceweave/core";
import { useEffect, useState } from "react";

function emptySnapshot(surfaceId: string): ActionExecutionSnapshot {
  return { surfaceId, interactionDisabled: false, states: [] };
}

/** Internal read-only bridge from a framework-neutral source into React. */
export function useActionExecution(
  source: ActionExecutionStateSource | undefined,
  surfaceId: string,
): ActionExecutionSnapshot {
  const [snapshot, setSnapshot] = useState<ActionExecutionSnapshot>(
    () => source?.getSnapshot(surfaceId) ?? emptySnapshot(surfaceId),
  );

  useEffect(() => {
    if (source === undefined) {
      setSnapshot(emptySnapshot(surfaceId));
      return;
    }
    const unsubscribe = source.subscribe(surfaceId, (next) => {
      if (next.surfaceId === surfaceId) setSnapshot(next);
    });
    setSnapshot(source.getSnapshot(surfaceId));
    return unsubscribe;
  }, [source, surfaceId]);

  return snapshot.surfaceId === surfaceId
    ? snapshot
    : (source?.getSnapshot(surfaceId) ?? emptySnapshot(surfaceId));
}
