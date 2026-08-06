import {
  DynamicUIError,
  InMemoryToolInvocationStore,
  InMemoryToolRegistry,
  assertMatchesJsonSchema,
  cloneValue,
  readDataPath,
} from "@package-first/core";
import type {
  ActionError,
  ActionIntent,
  ComponentRegistry,
  JsonObject,
  JsonSchema,
  JsonValue,
  Surface,
  SurfaceStore,
  ToolDefinition,
  ToolInvocation,
  ToolInvocationStore,
  ToolRegistry,
  ToolRuntimeEvent,
  ToolSubmissionRequest,
} from "@package-first/core";
import { generateSurface, generateToolSurface } from "@package-first/generator";

export interface CreateToolSurfaceInput {
  toolId: string;
  toolVersion?: string;
  surfaceId: string;
  invocationId?: string;
  correlationId?: string;
  initialValues?: JsonObject;
  context?: JsonObject;
}

export type ToolActionOutcome =
  | { kind: "state-changed"; invocation: ToolInvocation }
  | {
      kind: "confirmation-required";
      invocation: ToolInvocation;
      confirmationSurface: Surface;
    }
  | {
      kind: "invocation-requested";
      invocation: ToolInvocation;
      request: ToolSubmissionRequest;
    };

export type ToolRuntimeListener = (event: ToolRuntimeEvent) => void;
export type InvocationRequestListener = (
  request: ToolSubmissionRequest,
) => void;

function schemaObject(schema: JsonSchema): JsonObject | undefined {
  return schema === true || schema === false ? undefined : schema;
}

function schemaType(schema: JsonObject): string | undefined {
  if (typeof schema.type === "string") return schema.type;
  if (Array.isArray(schema.type)) {
    return schema.type.find(
      (value) => value !== "null" && typeof value === "string",
    ) as string | undefined;
  }
  return schema.properties === undefined ? undefined : "object";
}

function projectArguments(
  schema: JsonSchema,
  value: JsonValue,
  includeReadOnly: boolean,
): JsonValue {
  if (schema === true) return cloneValue(value);
  if (schema === false) return {};
  if (schema.readOnly === true && !includeReadOnly) return undefined as never;
  if (
    schemaType(schema) === "object" &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const properties = schemaObject(schema.properties as JsonSchema);
    if (properties === undefined) return cloneValue(value);
    const projected: JsonObject = {};
    for (const [name, propertySchema] of Object.entries(properties)) {
      if (!(name in value)) continue;
      const normalized = propertySchema as JsonSchema;
      if (
        normalized !== true &&
        normalized !== false &&
        normalized.readOnly === true &&
        !includeReadOnly
      ) {
        continue;
      }
      projected[name] = projectArguments(
        normalized,
        value[name] as JsonValue,
        includeReadOnly,
      );
    }
    return projected;
  }
  if (
    schemaType(schema) === "array" &&
    Array.isArray(value) &&
    schema.items !== undefined
  ) {
    return value.map((item) =>
      projectArguments(schema.items as JsonSchema, item, includeReadOnly),
    );
  }
  return cloneValue(value);
}

function collectReadOnlyPaths(schema: JsonSchema, path = ""): string[] {
  if (schema === true || schema === false) return [];
  const paths = schema.readOnly === true && path !== "" ? [path] : [];
  const properties = schemaObject(schema.properties as JsonSchema);
  if (properties !== undefined) {
    for (const [name, child] of Object.entries(properties)) {
      paths.push(
        ...collectReadOnlyPaths(
          child as JsonSchema,
          path === "" ? name : `${path}.${name}`,
        ),
      );
    }
  }
  return paths;
}

function redactArguments(
  argumentsValue: JsonObject,
  paths: string[],
): JsonObject {
  const redacted = cloneValue(argumentsValue);
  for (const path of paths) {
    const segments = path.split(".");
    let current: JsonObject | undefined = redacted;
    for (const segment of segments.slice(0, -1)) {
      const next: JsonValue | undefined = current?.[segment];
      current =
        typeof next === "object" && next !== null && !Array.isArray(next)
          ? next
          : undefined;
    }
    const key = segments.at(-1);
    if (current !== undefined && key !== undefined && key in current) {
      current[key] = "[REDACTED]";
    }
  }
  return redacted;
}

function intentObject(intent: ActionIntent): JsonObject {
  return typeof intent.input === "object" &&
    intent.input !== null &&
    !Array.isArray(intent.input)
    ? intent.input
    : {};
}

/** Coordinates Tool Surfaces and host requests without executing business APIs. */
export class ToolToUIRuntime {
  readonly #components: ComponentRegistry;
  readonly #surfaces: SurfaceStore;
  readonly #tools: ToolRegistry;
  readonly #invocations: ToolInvocationStore;
  readonly #surfaceInvocations = new Map<string, string>();
  readonly #initialReadOnly = new Map<
    string,
    Map<string, JsonValue | undefined>
  >();
  readonly #listeners = new Set<ToolRuntimeListener>();
  readonly #requestListeners = new Set<InvocationRequestListener>();
  #sequence = 0;
  #invocationSequence = 0;

  constructor(
    components: ComponentRegistry,
    surfaces: SurfaceStore,
    options: { tools?: ToolRegistry; invocations?: ToolInvocationStore } = {},
  ) {
    this.#components = components;
    this.#surfaces = surfaces;
    this.#tools = options.tools ?? new InMemoryToolRegistry();
    this.#invocations =
      options.invocations ?? new InMemoryToolInvocationStore();
  }

  registerTool(definition: ToolDefinition): void {
    this.#tools.register(definition);
  }

  listTools(): ToolDefinition[] {
    return this.#tools.list();
  }

  inspectTool(toolId: string, version?: string): ToolDefinition {
    return this.#tools.require(toolId, version);
  }

  inspectInvocation(invocationId: string): ToolInvocation {
    return this.#invocations.require(invocationId);
  }

  subscribe(listener: ToolRuntimeListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  onInvocationRequested(listener: InvocationRequestListener): () => void {
    this.#requestListeners.add(listener);
    return () => this.#requestListeners.delete(listener);
  }

  createToolSurface(input: CreateToolSurfaceInput): {
    invocation: ToolInvocation;
    surface: Surface;
  } {
    const definition = this.#tools.require(input.toolId, input.toolVersion);
    this.#invocationSequence += 1;
    const invocationId =
      input.invocationId ?? `invocation-${this.#invocationSequence}`;
    const correlationId = input.correlationId ?? invocationId;
    const generated = generateToolSurface(
      {
        definition,
        surfaceId: input.surfaceId,
        ...(input.initialValues === undefined
          ? {}
          : { initialValues: input.initialValues }),
        context: {
          ...(input.context ?? {}),
          invocationId,
          correlationId,
        },
      },
      this.#components,
    );
    generated.tree.props.submitAction = "tool.submit";
    generated.tree.props.invocationId = invocationId;
    const surface = this.#surfaces.createSurface(generated);
    const invocation = this.#invocations.create({
      id: invocationId,
      toolId: definition.id,
      toolVersion: definition.version,
      sourceSurfaceId: surface.id,
      correlationId,
      status: "editing",
    });
    this.#surfaceInvocations.set(surface.id, invocation.id);
    const readOnly = new Map<string, JsonValue | undefined>();
    for (const path of collectReadOnlyPaths(definition.inputSchema)) {
      readOnly.set(path, cloneValue(readDataPath(surface.data, path)));
    }
    this.#initialReadOnly.set(invocation.id, readOnly);
    this.#surfaces.subscribe(surface.id, (event) => {
      if (event.type === "surface.dataChanged") {
        this.#publish(invocation.id, "tool.inputChanged", {
          surfaceId: surface.id,
        });
      }
    });
    this.#publish(invocation.id, "tool.surfaceCreated", {
      surfaceId: surface.id,
    });
    return { invocation, surface };
  }

  handleAction(intent: ActionIntent): ToolActionOutcome {
    const input = intentObject(intent);
    const requestedId =
      typeof input.invocationId === "string" ? input.invocationId : undefined;
    const invocationId =
      requestedId ?? this.#surfaceInvocations.get(intent.surfaceId);
    if (invocationId === undefined) {
      throw new DynamicUIError(
        "INVOCATION_NOT_FOUND",
        "Action is not connected to a Tool invocation",
      );
    }
    const invocation = this.#invocations.require(invocationId);
    if (
      invocation.sourceSurfaceId !== intent.surfaceId &&
      this.#surfaceInvocations.get(intent.surfaceId) !== invocationId
    ) {
      throw new DynamicUIError(
        "INVALID_ACTION_INTENT",
        "Action Surface does not belong to the invocation",
      );
    }
    switch (intent.action) {
      case "tool.cancel": {
        const cancelled = this.#invocations.transition(
          invocation.id,
          "cancelled",
        );
        this.#publish(invocation.id, "tool.invocationCancelled");
        return { kind: "state-changed", invocation: cancelled };
      }
      case "tool.edit": {
        const editing = this.#invocations.transition(invocation.id, "editing");
        return { kind: "state-changed", invocation: editing };
      }
      case "tool.retry":
        return this.#retry(invocation);
      case "tool.validate":
        this.#validate(invocation);
        return {
          kind: "state-changed",
          invocation: this.#invocations.require(invocation.id),
        };
      case "tool.request-confirmation":
      case "tool.submit":
        return this.#submit(invocation, input.confirmed === true);
      default:
        throw new DynamicUIError(
          "INVALID_ACTION_INTENT",
          `Action "${intent.action}" is not a Tool action`,
        );
    }
  }

  markInvocationStarted(invocationId: string): ToolInvocation {
    const invocation = this.#invocations.require(invocationId);
    if (invocation.status !== "submitting") {
      throw new DynamicUIError(
        "INVALID_INVOCATION_TRANSITION",
        "Only a submitting invocation can start",
      );
    }
    this.#publish(invocationId, "tool.invocationStarted");
    return invocation;
  }

  resolveInvocation(invocationId: string, result: JsonValue): ToolInvocation {
    cloneValue(result);
    const invocation = this.#invocations.transition(invocationId, "success");
    this.#setSubmitting(invocation.sourceSurfaceId, false);
    this.#publish(invocationId, "tool.invocationSucceeded");
    return invocation;
  }

  rejectInvocation(invocationId: string, error: ActionError): ToolInvocation {
    const invocation = this.#invocations.transition(invocationId, "error", {
      error,
    });
    this.#setSubmitting(invocation.sourceSurfaceId, false);
    this.#publish(invocationId, "tool.invocationFailed", { error });
    return invocation;
  }

  #validate(invocation: ToolInvocation): JsonObject {
    if (invocation.status === "editing" || invocation.status === "error") {
      this.#invocations.transition(invocation.id, "validating");
    } else if (invocation.status !== "validating") {
      throw new DynamicUIError(
        "INVALID_INVOCATION_TRANSITION",
        `Cannot validate while ${invocation.status}`,
      );
    }
    const definition = this.#tools.require(
      invocation.toolId,
      invocation.toolVersion,
    );
    const surface = this.#surfaces.requireSurface(invocation.sourceSurfaceId);
    const projected = projectArguments(
      definition.inputSchema,
      surface.data,
      true,
    );
    try {
      assertMatchesJsonSchema(
        definition.inputSchema,
        projected,
        `Arguments for ${definition.id}`,
        "TOOL_INPUT_INVALID",
      );
      for (const [path, initial] of this.#initialReadOnly.get(invocation.id) ??
        []) {
        if (
          JSON.stringify(readDataPath(surface.data, path)) !==
          JSON.stringify(initial)
        ) {
          throw new DynamicUIError(
            "TOOL_INPUT_INVALID",
            `Read-only field "${path}" was modified`,
          );
        }
      }
    } catch (error) {
      this.#invocations.transition(invocation.id, "editing");
      this.#publish(invocation.id, "tool.validationFailed", {
        error: {
          code:
            error instanceof DynamicUIError ? error.code : "TOOL_INPUT_INVALID",
          message:
            error instanceof Error ? error.message : "Tool input is invalid",
        },
      });
      throw error;
    }
    return projectArguments(
      definition.inputSchema,
      surface.data,
      false,
    ) as JsonObject;
  }

  #submit(invocation: ToolInvocation, confirmed: boolean): ToolActionOutcome {
    if (invocation.status === "submitting") {
      throw new DynamicUIError(
        "DUPLICATE_SUBMISSION",
        `Invocation "${invocation.id}" is already submitting`,
      );
    }
    const definition = this.#tools.require(
      invocation.toolId,
      invocation.toolVersion,
    );
    const argumentsValue =
      invocation.status === "awaiting-confirmation"
        ? this.#validatedArguments(invocation)
        : this.#validate(invocation);
    const confirmationRequired =
      definition.annotations?.sideEffect === true ||
      definition.annotations?.confirmation === "required";
    if (confirmationRequired && !confirmed) {
      const awaiting = this.#invocations.transition(
        invocation.id,
        "awaiting-confirmation",
      );
      const confirmationSurface = this.#confirmationSurface(
        awaiting,
        argumentsValue,
      );
      this.#publish(invocation.id, "tool.confirmationRequested", {
        surfaceId: confirmationSurface.id,
        redactedArguments: redactArguments(
          argumentsValue,
          definition.annotations?.sensitiveInputPaths ?? [],
        ),
      });
      return {
        kind: "confirmation-required",
        invocation: awaiting,
        confirmationSurface,
      };
    }
    return this.#request(invocation.id, argumentsValue, false);
  }

  #retry(invocation: ToolInvocation): ToolActionOutcome {
    const definition = this.#tools.require(
      invocation.toolId,
      invocation.toolVersion,
    );
    if (
      invocation.status !== "error" ||
      definition.annotations?.retry !== "safe"
    ) {
      throw new DynamicUIError(
        "TOOL_RETRY_NOT_ALLOWED",
        `Tool "${definition.id}" is not safely retryable`,
      );
    }
    this.#publish(invocation.id, "tool.retryRequested");
    return this.#request(
      invocation.id,
      this.#validatedArguments(invocation),
      true,
    );
  }

  #validatedArguments(invocation: ToolInvocation): JsonObject {
    const definition = this.#tools.require(
      invocation.toolId,
      invocation.toolVersion,
    );
    const surface = this.#surfaces.requireSurface(invocation.sourceSurfaceId);
    const projected = projectArguments(
      definition.inputSchema,
      surface.data,
      true,
    );
    assertMatchesJsonSchema(
      definition.inputSchema,
      projected,
      `Arguments for ${definition.id}`,
      "TOOL_INPUT_INVALID",
    );
    return projectArguments(
      definition.inputSchema,
      surface.data,
      false,
    ) as JsonObject;
  }

  #request(
    invocationId: string,
    argumentsValue: JsonObject,
    retry: boolean,
  ): ToolActionOutcome {
    const current = this.#invocations.require(invocationId);
    const attempt = current.attempt + 1;
    const idempotencyKey =
      retry && current.lastIdempotencyKey !== undefined
        ? current.lastIdempotencyKey
        : `${current.id}:${attempt}`;
    const invocation = this.#invocations.transition(
      invocationId,
      "submitting",
      {
        attempt,
        lastIdempotencyKey: idempotencyKey,
      },
    );
    this.#setSubmitting(invocation.sourceSurfaceId, true);
    const sequence = this.#nextSequence();
    const request: ToolSubmissionRequest = {
      invocationId: invocation.id,
      toolId: invocation.toolId,
      toolVersion: invocation.toolVersion,
      validatedArguments: cloneValue(argumentsValue),
      correlationId: invocation.correlationId,
      idempotencyKey,
      sourceSurfaceId: invocation.sourceSurfaceId,
      sequence,
    };
    const definition = this.#tools.require(
      invocation.toolId,
      invocation.toolVersion,
    );
    this.#emit({
      type: "tool.invocationRequested",
      sequence,
      invocationId: invocation.id,
      correlationId: invocation.correlationId,
      toolId: invocation.toolId,
      toolVersion: invocation.toolVersion,
      status: invocation.status,
      surfaceId: invocation.sourceSurfaceId,
      redactedArguments: redactArguments(
        argumentsValue,
        definition.annotations?.sensitiveInputPaths ?? [],
      ),
    });
    for (const listener of this.#requestListeners)
      listener(cloneValue(request));
    return { kind: "invocation-requested", invocation, request };
  }

  #confirmationSurface(
    invocation: ToolInvocation,
    argumentsValue: JsonObject,
  ): Surface {
    const surfaceId = `${invocation.sourceSurfaceId}--confirmation`;
    const existing = this.#surfaces.getSurface(surfaceId);
    if (existing !== undefined) return existing;
    const definition = this.#tools.require(
      invocation.toolId,
      invocation.toolVersion,
    );
    const generated = generateSurface(
      {
        surfaceId,
        schema: { type: "object", title: definition.title ?? definition.id },
        data: redactArguments(
          argumentsValue,
          definition.annotations?.sensitiveInputPaths ?? [],
        ),
        intent: "confirm",
        metadata: {
          title: "Confirm tool submission",
          description: `Submit ${definition.title ?? definition.id}?`,
        },
        context: { source: "tool.confirmation", invocationId: invocation.id },
      },
      this.#components,
    );
    generated.tree.props.confirmAction = "tool.submit";
    generated.tree.props.cancelAction = "tool.cancel";
    generated.tree.props.invocationId = invocation.id;
    const surface = this.#surfaces.createSurface(generated);
    this.#surfaceInvocations.set(surface.id, invocation.id);
    return surface;
  }

  #setSubmitting(surfaceId: string, submitting: boolean): void {
    const surface = this.#surfaces.requireSurface(surfaceId);
    if (surface.tree.props.submitting === submitting) return;
    this.#surfaces.applyOperations(surfaceId, surface.revision, [
      { type: "setProps", target: surface.tree.id, props: { submitting } },
    ]);
  }

  #publish(
    invocationId: string,
    type: ToolRuntimeEvent["type"],
    fields: Pick<
      ToolRuntimeEvent,
      | "surfaceId"
      | "resultSurfaceId"
      | "redactedArguments"
      | "error"
      | "details"
    > = {},
  ): void {
    const invocation = this.#invocations.require(invocationId);
    this.#emit({
      type,
      sequence: this.#nextSequence(),
      invocationId,
      correlationId: invocation.correlationId,
      toolId: invocation.toolId,
      toolVersion: invocation.toolVersion,
      status: invocation.status,
      ...cloneValue(fields),
    });
  }

  #emit(event: ToolRuntimeEvent): void {
    for (const listener of this.#listeners) listener(cloneValue(event));
  }

  #nextSequence(): number {
    this.#sequence += 1;
    return this.#sequence;
  }
}
