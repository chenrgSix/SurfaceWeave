import { DynamicUIError, createActionIntent } from "@surfaceweave/core";
import type {
  ActionExecutionSnapshot,
  ActionExecutionStateSource,
  ComponentRegistry,
  JsonValue,
  SurfaceStore,
} from "@surfaceweave/core";
import {
  PureComponent,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import type { ReactComponentRegistry } from "./react-component-registry.js";
import { safeLayoutItemStyle } from "./standard-components.js";
import { SurfaceReadModel } from "./surface-read-model.js";
import type { SurfaceNodeSnapshot } from "./surface-read-model.js";
import type { ActionIntentHandler, RendererMode } from "./types.js";
import { useActionExecution } from "./use-action-execution.js";

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
  actionStateSource?: ActionExecutionStateSource;
  onError?: (error: DynamicUIError) => void;
}

interface NodeRenderContext {
  surfaceId: string;
  store: SurfaceStore;
  componentRegistry: ComponentRegistry;
  reactComponents: ReactComponentRegistry;
  mode: RendererMode;
  preferredPack: string | undefined;
  enabledPackIds: string[] | undefined;
  capabilities: string[] | undefined;
  packPriorities: Record<string, number> | undefined;
  supportedPackVersions: Record<string, string[]> | undefined;
  onActionIntent: ActionIntentHandler | undefined;
  actionExecution: ActionExecutionSnapshot;
  report(error: unknown): void;
  nextActionId(nodeId: string, action: string): string;
}

interface SurfaceNodeProps {
  model: SurfaceReadModel;
  nodeId: string;
  context: NodeRenderContext;
}

function asDynamicUIError(error: unknown): DynamicUIError {
  if (error instanceof DynamicUIError) {
    return error;
  }
  return new DynamicUIError("INVALID_SURFACE", "React renderer failed", {
    cause: error instanceof Error ? error.message : String(error),
  });
}

class SurfaceNode extends PureComponent<SurfaceNodeProps, SurfaceNodeSnapshot> {
  state = this.props.model.getNodeSnapshot(this.props.nodeId);
  #unsubscribe: (() => void) | undefined;

  componentDidMount(): void {
    this.#subscribe();
  }

  componentDidUpdate(previous: SurfaceNodeProps): void {
    if (
      previous.model === this.props.model &&
      previous.nodeId === this.props.nodeId
    ) {
      return;
    }
    this.#unsubscribe?.();
    this.setState(this.props.model.getNodeSnapshot(this.props.nodeId));
    this.#subscribe();
  }

  componentWillUnmount(): void {
    this.#unsubscribe?.();
  }

  #subscribe(): void {
    this.#unsubscribe = this.props.model.subscribeNode(
      this.props.nodeId,
      () => {
        this.setState(this.props.model.getNodeSnapshot(this.props.nodeId));
      },
    );
  }

  render(): ReactNode {
    const { model, context } = this.props;
    const { node, value } = this.state;
    if (node === undefined || node.visible === false) return null;

    const resolved = context.reactComponents.resolve(node.component, {
      ...(context.preferredPack === undefined
        ? {}
        : { preferredPack: context.preferredPack }),
      ...(context.capabilities === undefined
        ? {}
        : { capabilities: context.capabilities }),
      ...(context.enabledPackIds === undefined
        ? {}
        : { availablePackIds: context.enabledPackIds }),
      ...(context.packPriorities === undefined
        ? {}
        : { packPriorities: context.packPriorities }),
      ...(context.supportedPackVersions === undefined
        ? {}
        : { supportedPackVersions: context.supportedPackVersions }),
    });
    const Component = resolved.component;
    const children = node.children?.map((child) => (
      <SurfaceNode
        key={child.id}
        model={model}
        nodeId={child.id}
        context={context}
      />
    ));
    const component = (
      <Component
        node={node}
        value={value}
        mode={context.mode}
        actionStates={context.actionExecution.states}
        interactionDisabled={context.actionExecution.interactionDisabled}
        onValueChange={(nextValue) => {
          if (node.binding === undefined) {
            context.report(
              new DynamicUIError(
                "INVALID_OPERATION",
                `Component "${node.component}" has no data binding`,
              ),
            );
            return;
          }
          try {
            context.store.updateData(
              context.surfaceId,
              model.getSurface().revision,
              [{ path: node.binding.path, value: nextValue }],
            );
          } catch (error) {
            context.report(error);
          }
        }}
        onAction={(action, input: JsonValue) => {
          if (
            context.onActionIntent === undefined ||
            context.actionExecution.interactionDisabled
          ) {
            return;
          }
          try {
            context.onActionIntent(
              createActionIntent(
                context.componentRegistry,
                model.getSurface(),
                {
                  id: context.nextActionId(node.id, action),
                  nodeId: node.id,
                  action,
                  input,
                },
              ),
            );
          } catch (error) {
            context.report(error);
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
    const layoutStyle = safeLayoutItemStyle(node.layout, context.mode);
    return Object.keys(layoutStyle).length === 0 ? (
      rendered
    ) : (
      <div style={layoutStyle}>{rendered}</div>
    );
  }
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
  actionStateSource,
  onError,
}: SurfaceRendererProps) {
  const model = useMemo(
    () => new SurfaceReadModel(store, surfaceId),
    [store, surfaceId],
  );
  const surface = useSyncExternalStore(
    model.subscribeSurface,
    model.getSurface,
    model.getSurface,
  );
  const actionExecution = useActionExecution(actionStateSource, surfaceId);
  const report = useCallback(
    (error: unknown): void => {
      const dynamicError = asDynamicUIError(error);
      if (onError !== undefined) {
        onError(dynamicError);
        return;
      }
      throw dynamicError;
    },
    [onError],
  );
  const nextActionId = useCallback(
    (nodeId: string, action: string): string => {
      // Each interaction needs its own identity across views and remounts.
      // getRandomValues also works on HTTP hosts where randomUUID is unavailable.
      const nonce = Array.from(
        globalThis.crypto.getRandomValues(new Uint32Array(4)),
        (word) => word.toString(16).padStart(8, "0"),
      ).join("");
      return `${surfaceId}:${nodeId}:${action}:${nonce}`;
    },
    [surfaceId],
  );
  const selectedPreferredPack =
    preferredPack ?? surface.presentation?.preferredPack;
  const context = useMemo<NodeRenderContext>(
    () => ({
      surfaceId,
      store,
      componentRegistry,
      reactComponents,
      mode,
      preferredPack: selectedPreferredPack,
      enabledPackIds,
      capabilities,
      packPriorities,
      supportedPackVersions,
      onActionIntent,
      actionExecution,
      report,
      nextActionId,
    }),
    [
      surfaceId,
      store,
      componentRegistry,
      reactComponents,
      mode,
      selectedPreferredPack,
      enabledPackIds,
      capabilities,
      packPriorities,
      supportedPackVersions,
      onActionIntent,
      actionExecution,
      report,
      nextActionId,
    ],
  );

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
      <SurfaceNode
        key={surface.id}
        model={model}
        nodeId={surface.tree.id}
        context={context}
      />
    </div>
  );
}
