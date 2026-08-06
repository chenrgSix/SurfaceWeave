import { DynamicUIError, cloneValue, walkNodes } from "@package-first/core";
import type {
  ComponentRegistry,
  DeveloperHardConstraints,
  Surface,
  SurfaceStore,
} from "@package-first/core";
import { generateSurface } from "@package-first/generator";
import {
  assertOperationsAllowedByHardConstraints,
  assertSurfaceSatisfiesHardConstraints,
} from "@package-first/preferences";
import type { PreferenceService } from "@package-first/preferences";

import { surfaceToolDefinitions } from "./definitions.js";
import type {
  ComponentCatalogInspection,
  SurfaceInspection,
  ToolResult,
  UIToolDefinition,
  UIToolValue,
} from "./types.js";
import {
  ToolInputError,
  parseApplyOperations,
  parseCreateSurface,
  parseInspectComponentPacks,
  parseInspectSurface,
  parseReplaceSurface,
} from "./validation.js";

function runTool<T>(operation: () => T): ToolResult<T> {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    if (error instanceof DynamicUIError) {
      const toolError: ToolResult<T> = {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
      if (error.details !== undefined) {
        toolError.error.details = cloneValue(error.details);
      }
      return toolError;
    }
    if (error instanceof ToolInputError) {
      return {
        ok: false,
        error: { code: error.code, message: error.message },
      };
    }
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "The UI tool failed unexpectedly",
      },
    };
  }
}

function inspect(surface: Surface): SurfaceInspection {
  const nodes: SurfaceInspection["nodes"] = [];
  const dataPaths = new Set<string>();
  walkNodes(surface.tree, (node) => {
    const inspected: SurfaceInspection["nodes"][number] = {
      id: node.id,
      component: node.component,
      visible: node.visible !== false,
      childCount: node.children?.length ?? 0,
    };
    if (node.stableId !== undefined) {
      inspected.stableId = node.stableId;
    }
    if (node.binding !== undefined) {
      inspected.binding = cloneValue(node.binding);
      dataPaths.add(node.binding.path);
    }
    nodes.push(inspected);
  });
  const inspection: SurfaceInspection = {
    id: surface.id,
    revision: surface.revision,
    intent: surface.intent,
    nodes,
    dataPaths: [...dataPaths].sort(),
  };
  if (surface.schemaRef !== undefined) {
    inspection.schemaRef = cloneValue(surface.schemaRef);
  }
  return inspection;
}

/** Host-neutral synchronous Surface tools, including temporary Agent overrides. */
export class AgentUIToolRuntime {
  readonly #registry: ComponentRegistry;
  readonly #store: SurfaceStore;
  readonly #preferences: PreferenceService | undefined;
  readonly #constraints = new Map<string, DeveloperHardConstraints>();

  constructor(
    registry: ComponentRegistry,
    store: SurfaceStore,
    preferences?: PreferenceService,
  ) {
    this.#registry = registry;
    this.#store = store;
    this.#preferences = preferences;
  }

  definitions(): UIToolDefinition[] {
    return cloneValue(surfaceToolDefinitions);
  }

  execute(name: string, argumentsValue: unknown): ToolResult<UIToolValue> {
    switch (name) {
      case "ui.createSurface":
        return this.createSurface(argumentsValue);
      case "ui.inspectSurface":
        return this.inspectSurface(argumentsValue);
      case "ui.inspectComponentPacks":
        return this.inspectComponentPacks(argumentsValue);
      case "ui.applyOperations":
        return this.applyOperations(argumentsValue);
      case "ui.replaceSurface":
        return this.replaceSurface(argumentsValue);
      default:
        return {
          ok: false,
          error: {
            code: "UNKNOWN_TOOL",
            message: `UI tool "${name}" is not registered`,
          },
        };
    }
  }

  createSurface(argumentsValue: unknown): ToolResult<Surface> {
    return runTool(() => {
      const input = parseCreateSurface(argumentsValue);
      const defaultSurface: Surface = {
        ...generateSurface(input, this.#registry),
        revision: 0,
      };
      const constraints = input.developer?.hardConstraints;
      const preferenceResult = this.#preferences?.applyPreferences(
        defaultSurface,
        {
          ...(input.toolId === undefined ? {} : { toolId: input.toolId }),
          ...(input.schemaRef === undefined
            ? {}
            : { schemaRef: input.schemaRef }),
          ...(input.fieldAliases === undefined
            ? {}
            : { fieldAliases: input.fieldAliases }),
          ...(constraints === undefined
            ? {}
            : { hardConstraints: constraints }),
        },
      );
      const created = this.#store.createSurface(
        preferenceResult?.surface ?? defaultSurface,
      );
      if (constraints !== undefined) {
        this.#constraints.set(input.surfaceId, cloneValue(constraints));
      }
      return created;
    });
  }

  inspectSurface(argumentsValue: unknown): ToolResult<SurfaceInspection> {
    return runTool(() => {
      const input = parseInspectSurface(argumentsValue);
      return inspect(this.#store.requireSurface(input.surfaceId));
    });
  }

  inspectComponentPacks(
    argumentsValue: unknown,
  ): ToolResult<ComponentCatalogInspection> {
    return runTool(() => {
      const input = parseInspectComponentPacks(argumentsValue);
      const available = new Set(input.capabilities ?? []);
      return {
        protocolVersion: "1.0",
        components: this.#registry.list(),
        packs: this.#registry.listPacks().filter((pack) => {
          if (
            input.rendererKind !== undefined &&
            pack.rendererKind !== input.rendererKind
          ) {
            return false;
          }
          return (
            input.capabilities === undefined ||
            (pack.capabilities ?? []).every((capability) =>
              available.has(capability),
            )
          );
        }),
      };
    });
  }

  applyOperations(argumentsValue: unknown): ToolResult<Surface> {
    return runTool(() => {
      const input = parseApplyOperations(argumentsValue);
      const current = this.#store.requireSurface(input.surfaceId);
      this.#assertRevision(current, input.baseRevision);
      assertOperationsAllowedByHardConstraints(
        current,
        input.operations,
        this.#constraints.get(input.surfaceId),
        this.#registry,
      );
      return this.#store.applyOperations(
        input.surfaceId,
        input.baseRevision,
        input.operations,
      );
    });
  }

  replaceSurface(argumentsValue: unknown): ToolResult<Surface> {
    return runTool(() => {
      const input = parseReplaceSurface(argumentsValue);
      const current = this.#store.requireSurface(input.surfaceId);
      this.#assertRevision(current, input.baseRevision);
      assertSurfaceSatisfiesHardConstraints(
        {
          ...cloneValue(input.surface),
          id: input.surfaceId,
          revision: current.revision + 1,
        },
        this.#constraints.get(input.surfaceId),
        current,
      );
      return this.#store.replaceSurface(
        input.surfaceId,
        input.baseRevision,
        input.surface,
      );
    });
  }

  #assertRevision(surface: Surface, baseRevision: number): void {
    if (surface.revision !== baseRevision) {
      throw new DynamicUIError(
        "REVISION_CONFLICT",
        `Surface "${surface.id}" is at revision ${surface.revision}, not ${baseRevision}`,
        { expected: baseRevision, actual: surface.revision },
      );
    }
  }
}
