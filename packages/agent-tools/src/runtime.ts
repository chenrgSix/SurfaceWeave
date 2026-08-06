import { DynamicUIError, cloneValue, walkNodes } from "@surfaceweave/core";
import type {
  ComponentRegistry,
  DeveloperHardConstraints,
  JsonObject,
  Surface,
  SurfaceStore,
} from "@surfaceweave/core";
import { generateSurface } from "@surfaceweave/generator";
import {
  assertOperationsAllowedByHardConstraints,
  assertSurfaceSatisfiesHardConstraints,
} from "@surfaceweave/preferences";
import type { PreferenceService } from "@surfaceweave/preferences";

import {
  surfaceToolDefinitions,
  toolRuntimeToolDefinitions,
} from "./definitions.js";
import type { ToolToUIRuntime } from "./tool-runtime.js";
import type {
  ComponentCatalogInspection,
  SurfaceInspection,
  ToolResult,
  UIToolDefinition,
  UIToolValue,
  ToolCatalogInspection,
  ToolProposalResult,
  ToolSurfaceCreation,
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

function objectArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolInputError("arguments must be an object");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const item = value[key];
  if (typeof item !== "string" || item.trim() === "") {
    throw new ToolInputError(`arguments.${key} must be a non-empty string`);
  }
  return item;
}

function allowedArguments(
  value: Record<string, unknown>,
  keys: string[],
): void {
  const allowed = new Set(keys);
  const unsupported = Object.keys(value).find((key) => !allowed.has(key));
  if (unsupported !== undefined) {
    throw new ToolInputError(`arguments.${unsupported} is not supported`);
  }
}

function optionalObject(
  value: Record<string, unknown>,
  key: string,
): JsonObject | undefined {
  const item = value[key];
  if (item === undefined) return undefined;
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new ToolInputError(`arguments.${key} must be an object`);
  }
  return cloneValue(item) as JsonObject;
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
  readonly #toolRuntime: ToolToUIRuntime | undefined;
  readonly #constraints = new Map<string, DeveloperHardConstraints>();

  constructor(
    registry: ComponentRegistry,
    store: SurfaceStore,
    preferences?: PreferenceService,
    toolRuntime?: ToolToUIRuntime,
  ) {
    this.#registry = registry;
    this.#store = store;
    this.#preferences = preferences;
    this.#toolRuntime = toolRuntime;
  }

  definitions(): UIToolDefinition[] {
    return cloneValue([
      ...surfaceToolDefinitions,
      ...toolRuntimeToolDefinitions,
    ]);
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
      case "ui.inspectTools":
        return this.inspectTools(argumentsValue);
      case "ui.inspectTool":
        return this.inspectTool(argumentsValue);
      case "ui.createToolSurface":
        return this.createToolSurface(argumentsValue);
      case "ui.inspectInvocation":
        return this.inspectInvocation(argumentsValue);
      case "ui.proposeToolSubmission":
        return this.proposeToolSubmission(argumentsValue);
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

  inspectTools(argumentsValue: unknown): ToolResult<ToolCatalogInspection> {
    return runTool(() => {
      const input = objectArguments(argumentsValue);
      allowedArguments(input, []);
      if (Object.keys(input).length !== 0) {
        throw new ToolInputError("ui.inspectTools does not accept arguments");
      }
      const runtime = this.#requireToolRuntime();
      return {
        tools: runtime.listTools().map((tool) => ({
          id: tool.id,
          version: tool.version,
          ...(tool.title === undefined ? {} : { title: tool.title }),
          ...(tool.description === undefined
            ? {}
            : { description: tool.description }),
          ...(tool.annotations === undefined
            ? {}
            : { annotations: tool.annotations }),
        })),
      };
    });
  }

  inspectTool(argumentsValue: unknown) {
    return runTool(() => {
      const input = objectArguments(argumentsValue);
      allowedArguments(input, ["toolId", "toolVersion"]);
      const toolId = requiredString(input, "toolId");
      const toolVersion =
        input.toolVersion === undefined
          ? undefined
          : requiredString(input, "toolVersion");
      return this.#requireToolRuntime().inspectTool(toolId, toolVersion);
    });
  }

  createToolSurface(argumentsValue: unknown): ToolResult<ToolSurfaceCreation> {
    return runTool(() => {
      const input = objectArguments(argumentsValue);
      allowedArguments(input, [
        "toolId",
        "toolVersion",
        "surfaceId",
        "invocationId",
        "correlationId",
        "initialValues",
        "context",
      ]);
      const toolId = requiredString(input, "toolId");
      const surfaceId = requiredString(input, "surfaceId");
      const toolVersion =
        input.toolVersion === undefined
          ? undefined
          : requiredString(input, "toolVersion");
      const invocationId =
        input.invocationId === undefined
          ? undefined
          : requiredString(input, "invocationId");
      const correlationId =
        input.correlationId === undefined
          ? undefined
          : requiredString(input, "correlationId");
      return this.#requireToolRuntime().createToolSurface({
        toolId,
        surfaceId,
        ...(toolVersion === undefined ? {} : { toolVersion }),
        ...(invocationId === undefined ? {} : { invocationId }),
        ...(correlationId === undefined ? {} : { correlationId }),
        ...(optionalObject(input, "initialValues") === undefined
          ? {}
          : {
              initialValues: optionalObject(
                input,
                "initialValues",
              ) as JsonObject,
            }),
        ...(optionalObject(input, "context") === undefined
          ? {}
          : { context: optionalObject(input, "context") as JsonObject }),
      });
    });
  }

  inspectInvocation(argumentsValue: unknown) {
    return runTool(() => {
      const input = objectArguments(argumentsValue);
      allowedArguments(input, ["invocationId"]);
      return this.#requireToolRuntime().inspectInvocation(
        requiredString(input, "invocationId"),
      );
    });
  }

  proposeToolSubmission(
    argumentsValue: unknown,
  ): ToolResult<ToolProposalResult> {
    return runTool(() => {
      const input = objectArguments(argumentsValue);
      allowedArguments(input, ["invocationId"]);
      const runtime = this.#requireToolRuntime();
      const invocation = runtime.inspectInvocation(
        requiredString(input, "invocationId"),
      );
      const surface = this.#store.requireSurface(invocation.sourceSurfaceId);
      const outcome = runtime.handleAction({
        id: `${invocation.id}:agent-proposal:${invocation.revision}`,
        surfaceId: surface.id,
        nodeId: surface.tree.id,
        action: "tool.submit",
        input: { invocationId: invocation.id },
        correlationId: invocation.correlationId,
      });
      return {
        invocation: outcome.invocation,
        outcome: outcome.kind,
        ...(outcome.kind === "confirmation-required"
          ? { confirmationSurfaceId: outcome.confirmationSurface.id }
          : {}),
      };
    });
  }

  #requireToolRuntime(): ToolToUIRuntime {
    if (this.#toolRuntime === undefined) {
      throw new ToolInputError("Tool-to-UI Runtime is not configured");
    }
    return this.#toolRuntime;
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
