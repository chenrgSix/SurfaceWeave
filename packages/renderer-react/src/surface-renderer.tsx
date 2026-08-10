import {
  DynamicUIError,
  createActionIntent,
  readDataPath,
} from "@surfaceweave/core";
import type {
  ComponentRegistry,
  JsonValue,
  SurfaceStore,
  UINode,
} from "@surfaceweave/core";
import { Fragment, useRef } from "react";
import type { ReactNode } from "react";

import type { ReactComponentRegistry } from "./react-component-registry.js";
import { safeLayoutItemStyle } from "./standard-components.js";
import type { ActionIntentHandler, RendererMode } from "./types.js";
import { useSurface } from "./use-surface.js";

export interface SurfaceRendererProps {
  surfaceId: string;
  store: SurfaceStore;
  componentRegistry: ComponentRegistry;
  reactComponents: ReactComponentRegistry;
  mode?: RendererMode;
  preferredPack?: string;
  /** Explicit host allow-list for runtime bindings available in this view. */
  enabledPackIds?: string[];
  capabilities?: string[];
  packPriorities?: Record<string, number>;
  supportedPackVersions?: Record<string, string[]>;
  onActionIntent?: ActionIntentHandler;
  onError?: (error: DynamicUIError) => void;
}

function asDynamicUIError(error: unknown): DynamicUIError {
  if (error instanceof DynamicUIError) {
    return error;
  }
  return new DynamicUIError("INVALID_SURFACE", "React renderer failed", {
    cause: error instanceof Error ? error.message : String(error),
  });
}

/** Renders only locally registered components and writes values through SurfaceStore. */
export function SurfaceRenderer({
  surfaceId,
  store,
  componentRegistry,
  reactComponents,
  mode = "workspace",
  preferredPack,
  enabledPackIds,
  capabilities,
  packPriorities,
  supportedPackVersions,
  onActionIntent,
  onError,
}: SurfaceRendererProps) {
  const surface = useSurface(store, surfaceId);
  const actionSequence = useRef(0);

  function report(error: unknown): void {
    const dynamicError = asDynamicUIError(error);
    if (onError !== undefined) {
      onError(dynamicError);
      return;
    }
    throw dynamicError;
  }

  function renderNode(node: UINode): ReactNode {
    if (node.visible === false) {
      return null;
    }
    const selectedPreferredPack =
      preferredPack ?? surface.presentation?.preferredPack;
    const resolved = reactComponents.resolve(node.component, {
      ...(selectedPreferredPack === undefined
        ? {}
        : { preferredPack: selectedPreferredPack }),
      ...(capabilities === undefined ? {} : { capabilities }),
      ...(enabledPackIds === undefined
        ? {}
        : { availablePackIds: enabledPackIds }),
      ...(packPriorities === undefined ? {} : { packPriorities }),
      ...(supportedPackVersions === undefined ? {} : { supportedPackVersions }),
    });
    const Component = resolved.component;
    const value =
      node.binding === undefined
        ? undefined
        : readDataPath(surface.data, node.binding.path);
    const children = node.children?.map((child) => (
      <Fragment key={child.id}>{renderNode(child)}</Fragment>
    ));
    const component = (
      <Component
        node={node}
        value={value}
        mode={mode}
        onValueChange={(nextValue) => {
          if (node.binding === undefined) {
            report(
              new DynamicUIError(
                "INVALID_OPERATION",
                `Component "${node.component}" has no data binding`,
              ),
            );
            return;
          }
          try {
            const current = store.requireSurface(surfaceId);
            store.updateData(surfaceId, current.revision, [
              { path: node.binding.path, value: nextValue },
            ]);
          } catch (error) {
            report(error);
          }
        }}
        onAction={(action, input: JsonValue) => {
          if (onActionIntent === undefined) {
            return;
          }
          try {
            actionSequence.current += 1;
            const current = store.requireSurface(surfaceId);
            onActionIntent(
              createActionIntent(componentRegistry, current, {
                id: `${surfaceId}:${node.id}:${action}:${actionSequence.current}`,
                nodeId: node.id,
                action,
                input,
              }),
            );
          } catch (error) {
            report(error);
          }
        }}
      >
        {children}
      </Component>
    );
    const rendered =
      resolved.Provider === undefined ? (
        component
      ) : (
        <resolved.Provider>{component}</resolved.Provider>
      );
    const layoutStyle = safeLayoutItemStyle(node.layout, mode);
    return Object.keys(layoutStyle).length === 0 ? (
      rendered
    ) : (
      <div style={layoutStyle}>{rendered}</div>
    );
  }

  return (
    <div
      data-surface-id={surface.id}
      data-surface-revision={surface.revision}
      data-surface-view={mode}
      style={{
        maxWidth: mode === "compact" ? 420 : undefined,
        padding: mode === "compact" ? 12 : 20,
      }}
    >
      {renderNode(surface.tree)}
    </div>
  );
}
