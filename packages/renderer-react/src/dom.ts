import { DynamicUIError } from "@surfaceweave/core";
import type {
  ActionExecutionStateSource,
  ComponentRegistry,
  SurfaceRendererDriver,
  SurfaceStore,
  SurfaceViewReference,
} from "@surfaceweave/core";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import type { ReactComponentRegistry } from "./react-component-registry.js";
import { SurfaceRenderer } from "./surface-renderer.js";
import type { SurfaceRendererProps } from "./surface-renderer.js";
import type { ActionIntentHandler } from "./types.js";

/** Trusted, host-owned configuration fixed for every view created by a driver. */
export interface ReactDOMRendererDriverOptions {
  store: SurfaceStore;
  componentRegistry: ComponentRegistry;
  reactComponents: ReactComponentRegistry;
  onActionIntent?: ActionIntentHandler;
  actionStateSource?: ActionExecutionStateSource;
  onError?: SurfaceRendererProps["onError"];
  enabledPackIds?: readonly string[];
  capabilities?: readonly string[];
  packPriorities?: Readonly<Record<string, number>>;
  supportedPackVersions?: Readonly<Record<string, readonly string[]>>;
}

function copyRecord(
  value: Readonly<Record<string, number>>,
): Record<string, number> {
  return { ...value };
}

function copyVersionConstraints(
  value: Readonly<Record<string, readonly string[]>>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(value).map(([packId, versions]) => [packId, [...versions]]),
  );
}

function readReference(reference: SurfaceViewReference): SurfaceViewReference {
  if (
    typeof reference !== "object" ||
    reference === null ||
    typeof reference.surfaceId !== "string" ||
    reference.surfaceId.length === 0 ||
    (reference.mode !== "compact" && reference.mode !== "workspace")
  ) {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      "Surface view reference requires a surfaceId and presentation mode",
    );
  }
  return { surfaceId: reference.surfaceId, mode: reference.mode };
}

/**
 * Creates a DOM mounting driver without adding react-dom to the React root
 * entry point. Security-sensitive options are captured from trusted host code.
 */
export function createReactDOMRendererDriver(
  options: ReactDOMRendererDriverOptions,
): SurfaceRendererDriver<Element> {
  const rendererOptions = {
    store: options.store,
    componentRegistry: options.componentRegistry,
    reactComponents: options.reactComponents,
    ...(options.onActionIntent === undefined
      ? {}
      : { onActionIntent: options.onActionIntent }),
    ...(options.actionStateSource === undefined
      ? {}
      : { actionStateSource: options.actionStateSource }),
    ...(options.onError === undefined ? {} : { onError: options.onError }),
    ...(options.enabledPackIds === undefined
      ? {}
      : { enabledPackIds: [...options.enabledPackIds] }),
    ...(options.capabilities === undefined
      ? {}
      : { capabilities: [...options.capabilities] }),
    ...(options.packPriorities === undefined
      ? {}
      : { packPriorities: copyRecord(options.packPriorities) }),
    ...(options.supportedPackVersions === undefined
      ? {}
      : {
          supportedPackVersions: copyVersionConstraints(
            options.supportedPackVersions,
          ),
        }),
  } satisfies Omit<SurfaceRendererProps, "surfaceId" | "mode">;

  return {
    mount(target, initialReference) {
      const initial = readReference(initialReference);
      options.store.requireSurface(initial.surfaceId);
      const root = createRoot(target);
      let mounted = true;

      const render = (reference: SurfaceViewReference): void => {
        const next = readReference(reference);
        options.store.requireSurface(next.surfaceId);
        root.render(
          createElement(SurfaceRenderer, {
            ...rendererOptions,
            surfaceId: next.surfaceId,
            mode: next.mode,
          }),
        );
      };

      render(initial);
      return {
        update(reference) {
          if (!mounted) return;
          render(reference);
        },
        unmount() {
          if (!mounted) return;
          mounted = false;
          root.unmount();
        },
      };
    },
  };
}
