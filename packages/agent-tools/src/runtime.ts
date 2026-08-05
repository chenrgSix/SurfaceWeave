import { DynamicUIError, cloneValue, walkNodes } from "@package-first/core";
import type {
  ComponentRegistry,
  Surface,
  SurfaceStore,
} from "@package-first/core";
import { generateSurface } from "@package-first/generator";

import { uiToolDefinitions } from "./definitions.js";
import type {
  SurfaceInspection,
  ToolResult,
  UIToolDefinition,
  UIToolValue,
} from "./types.js";
import {
  ToolInputError,
  parseApplyOperations,
  parseCreateSurface,
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

/** Host-neutral implementation behind all four Milestone 1 Agent UI tools. */
export class AgentUIToolRuntime {
  readonly #registry: ComponentRegistry;
  readonly #store: SurfaceStore;

  constructor(registry: ComponentRegistry, store: SurfaceStore) {
    this.#registry = registry;
    this.#store = store;
  }

  definitions(): UIToolDefinition[] {
    return cloneValue(uiToolDefinitions);
  }

  execute(name: string, argumentsValue: unknown): ToolResult<UIToolValue> {
    switch (name) {
      case "ui.createSurface":
        return this.createSurface(argumentsValue);
      case "ui.inspectSurface":
        return this.inspectSurface(argumentsValue);
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
      return this.#store.createSurface(generateSurface(input, this.#registry));
    });
  }

  inspectSurface(argumentsValue: unknown): ToolResult<SurfaceInspection> {
    return runTool(() => {
      const input = parseInspectSurface(argumentsValue);
      return inspect(this.#store.requireSurface(input.surfaceId));
    });
  }

  applyOperations(argumentsValue: unknown): ToolResult<Surface> {
    return runTool(() => {
      const input = parseApplyOperations(argumentsValue);
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
      return this.#store.replaceSurface(
        input.surfaceId,
        input.baseRevision,
        input.surface,
      );
    });
  }
}
