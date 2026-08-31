import {
  DynamicUIError,
  InMemoryToolInvocationStore,
  InMemoryToolRegistry,
  assertMatchesJsonSchema,
  cloneValue,
  migrateSurfaceData,
  readDataPath,
} from "@surfaceweave/core";
import type {
  ActionExecutionSnapshot,
  ActionExecutionState,
  ActionExecutionStateListener,
  ActionExecutionStateSource,
  ActionError,
  ActionIntent,
  ComponentRegistry,
  DeveloperHardConstraints,
  JsonObject,
  JsonSchema,
  JsonValue,
  SchemaFieldAliases,
  Surface,
  SurfaceDataMigrationResult,
  SurfaceStore,
  ToolDefinition,
  ToolInvocation,
  ToolInvocationStore,
  ToolRegistry,
  ToolRuntimeEvent,
  ToolSubmissionRequest,
} from "@surfaceweave/core";
import {
  generateResultSurface,
  generateSurface,
  generateToolSurface,
} from "@surfaceweave/generator";

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

export type ToolRuntimeListenerErrorHandler = (
  error: unknown,
  channel: "event" | "request",
  payload: ToolRuntimeEvent | ToolSubmissionRequest,
) => void;

export interface ToolToUIRuntimeOptions {
  tools?: ToolRegistry;
  invocations?: ToolInvocationStore;
  onListenerError?: ToolRuntimeListenerErrorHandler;
  now?: () => number;
}

export interface ToolExecutionError extends ActionError {
  retryable?: boolean;
}

export interface ResolveInvocationOptions {
  partialErrors?: ActionError[];
}

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

interface ToolActionProjectionMetadata {
  intentId: string;
  surfaceId: string;
  nodeId: string;
  action: string;
  startedAt: number;
  settledAt?: number;
}

interface PendingConfirmation {
  surfaceId: string;
  surfaceRevision: number;
  sourceRevision: number;
  argumentsValue: JsonObject;
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
  readonly #surfaceSubscriptions = new Map<string, () => void>();
  readonly #rawResults = new Map<string, JsonValue>();
  readonly #lastRequests = new Map<string, ToolSubmissionRequest>();
  readonly #pendingOutcomes = new Map<string, ToolActionOutcome>();
  readonly #confirmations = new Map<string, PendingConfirmation>();
  readonly #actionMetadata = new Map<string, ToolActionProjectionMetadata>();
  readonly #actionListeners = new Map<
    string,
    Set<ActionExecutionStateListener>
  >();
  readonly #interactionDisabled = new Set<string>();
  readonly #onListenerError: ToolRuntimeListenerErrorHandler | undefined;
  readonly #now: () => number;
  readonly #actionStateSource: ActionExecutionStateSource;
  #sequence = 0;
  #invocationSequence = 0;
  #confirmationSequence = 0;

  constructor(
    components: ComponentRegistry,
    surfaces: SurfaceStore,
    options: ToolToUIRuntimeOptions = {},
  ) {
    this.#components = components;
    this.#surfaces = surfaces;
    this.#tools = options.tools ?? new InMemoryToolRegistry();
    this.#invocations =
      options.invocations ?? new InMemoryToolInvocationStore();
    this.#onListenerError = options.onListenerError;
    this.#now = options.now ?? Date.now;
    this.#actionStateSource = {
      getSnapshot: (surfaceId) => this.#actionSnapshot(surfaceId),
      subscribe: (surfaceId, listener) =>
        this.#subscribeActionState(surfaceId, listener),
    };
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

  /** Resolves input UI policy through trusted invocation ownership, never Surface context. */
  getSurfaceHardConstraints(
    surfaceId: string,
  ): DeveloperHardConstraints | undefined {
    const invocationId = this.#surfaceInvocations.get(surfaceId);
    if (invocationId === undefined) return undefined;
    const invocation = this.#invocations.require(invocationId);
    if (invocation.sourceSurfaceId !== surfaceId) return undefined;
    return cloneValue(
      this.#tools.require(invocation.toolId, invocation.toolVersion).uiHints
        ?.hardConstraints,
    );
  }

  getRawResult(invocationId: string): JsonValue | undefined {
    const result = this.#rawResults.get(invocationId);
    return result === undefined ? undefined : cloneValue(result);
  }

  /** Read-only ToolInvocation projection for renderers and Component Packs. */
  get actionStateSource(): ActionExecutionStateSource {
    return this.#actionStateSource;
  }

  /** Host-only runtime gate used during recovery, reconnect, or mutual exclusion. */
  setInteractionDisabled(surfaceId: string, disabled: boolean): void {
    if (disabled) this.#interactionDisabled.add(surfaceId);
    else this.#interactionDisabled.delete(surfaceId);
    this.#publishActionState(surfaceId);
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
    if (this.#surfaces.getSurface(input.surfaceId) !== undefined) {
      throw new DynamicUIError(
        "SURFACE_EXISTS",
        `Surface "${input.surfaceId}" already exists`,
      );
    }
    let nextInvocationSequence = this.#invocationSequence;
    let invocationId = input.invocationId;
    if (invocationId !== undefined && invocationId.trim() === "") {
      throw new DynamicUIError(
        "INVALID_INVOCATION_TRANSITION",
        "Invocation id cannot be empty",
      );
    }
    if (invocationId === undefined) {
      do {
        nextInvocationSequence += 1;
        invocationId = `invocation-${nextInvocationSequence}`;
      } while (this.#invocations.get(invocationId) !== undefined);
    } else if (this.#invocations.get(invocationId) !== undefined) {
      throw new DynamicUIError(
        "INVOCATION_EXISTS",
        `Invocation "${invocationId}" already exists`,
      );
    }
    const correlationId = input.correlationId ?? invocationId;
    if (correlationId.trim() === "") {
      throw new DynamicUIError(
        "INVALID_INVOCATION_TRANSITION",
        "Invocation correlationId cannot be empty",
      );
    }
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
    this.#invocationSequence = nextInvocationSequence;
    this.#surfaceInvocations.set(surface.id, invocation.id);
    const readOnly = new Map<string, JsonValue | undefined>();
    for (const path of collectReadOnlyPaths(definition.inputSchema)) {
      readOnly.set(path, cloneValue(readDataPath(surface.data, path)));
    }
    this.#initialReadOnly.set(invocation.id, readOnly);
    const unsubscribe = this.#surfaces.subscribe(surface.id, (event) => {
      if (this.#confirmations.has(invocation.id)) {
        this.#invalidateConfirmation(invocation.id);
      }
      if (event.type === "surface.dataChanged") {
        this.#publish(invocation.id, "tool.inputChanged", {
          surfaceId: surface.id,
        });
      }
    });
    this.#surfaceSubscriptions.set(surface.id, unsubscribe);
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
    if (this.#interactionDisabled.has(intent.surfaceId)) {
      throw new DynamicUIError(
        "INVALID_ACTION_INTENT",
        `Actions are temporarily disabled for Surface "${intent.surfaceId}"`,
      );
    }
    if (invocation.status === "submitting") {
      const pending = this.#pendingOutcomes.get(invocation.id);
      if (
        pending !== undefined &&
        (intent.action === "tool.submit" ||
          intent.action === "tool.request-confirmation" ||
          intent.action === "tool.retry")
      ) {
        return cloneValue(pending);
      }
    }
    switch (intent.action) {
      case "tool.cancel": {
        const wasSubmitting = invocation.status === "submitting";
        const cancelled = this.#invocations.transition(
          invocation.id,
          "cancelled",
        );
        this.#confirmations.delete(invocation.id);
        if (wasSubmitting) {
          this.#setSubmitting(invocation.sourceSurfaceId, false);
        }
        this.#pendingOutcomes.delete(invocation.id);
        this.#recordAction(intent, true);
        this.#publish(invocation.id, "tool.invocationCancelled");
        this.#publishActionState(intent.surfaceId);
        return { kind: "state-changed", invocation: cancelled };
      }
      case "tool.edit": {
        const editing = this.#invocations.transition(invocation.id, "editing");
        this.#confirmations.delete(invocation.id);
        return { kind: "state-changed", invocation: editing };
      }
      case "tool.retry":
        return this.#retry(invocation, intent);
      case "tool.validate":
        this.#validate(invocation);
        return {
          kind: "state-changed",
          invocation: this.#invocations.require(invocation.id),
        };
      case "tool.request-confirmation":
      case "tool.submit":
        return this.#submit(invocation, input.confirmed === true, intent);
      case "result.continue":
        return { kind: "state-changed", invocation };
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

  resolveInvocation(
    invocationId: string,
    result: JsonValue,
    options: ResolveInvocationOptions = {},
  ): ToolInvocation {
    const current = this.#invocations.require(invocationId);
    if (current.status !== "submitting") {
      throw new DynamicUIError(
        "INVALID_INVOCATION_TRANSITION",
        `Invocation "${invocationId}" cannot resolve while ${current.status}`,
      );
    }
    const definition = this.#tools.require(current.toolId, current.toolVersion);
    if (definition.outputSchema !== undefined) {
      assertMatchesJsonSchema(
        definition.outputSchema,
        result,
        `Result for ${definition.id}`,
        "TOOL_OUTPUT_INVALID",
      );
    }
    const resultSurface = this.#createResultSurface(
      current,
      result,
      options.partialErrors?.length ? "partial" : "success",
      options.partialErrors,
      false,
    );
    const invocation = this.#invocations.transition(invocationId, "success", {
      resultSurfaceId: resultSurface.id,
    });
    this.#rawResults.set(invocationId, cloneValue(result));
    this.#settleAction(invocationId);
    this.#pendingOutcomes.delete(invocationId);
    this.#setSubmitting(invocation.sourceSurfaceId, false);
    this.#publish(invocationId, "tool.invocationSucceeded", {
      resultSurfaceId: resultSurface.id,
    });
    this.#publish(invocationId, "result.surfaceCreated", {
      surfaceId: resultSurface.id,
      resultSurfaceId: resultSurface.id,
    });
    this.#publishActionForInvocation(invocationId);
    return invocation;
  }

  rejectInvocation(
    invocationId: string,
    error: ToolExecutionError,
  ): ToolInvocation {
    const current = this.#invocations.require(invocationId);
    if (current.status !== "submitting") {
      throw new DynamicUIError(
        "INVALID_INVOCATION_TRANSITION",
        `Invocation "${invocationId}" cannot fail while ${current.status}`,
      );
    }
    const definition = this.#tools.require(current.toolId, current.toolVersion);
    const retryable =
      error.retryable !== false && definition.annotations?.retry === "safe";
    const resultSurface = this.#createResultSurface(
      current,
      undefined,
      "error",
      [error],
      retryable,
    );
    const actionError: ActionError = {
      code: error.code,
      message: error.message,
    };
    const invocation = this.#invocations.transition(invocationId, "error", {
      error: actionError,
      resultSurfaceId: resultSurface.id,
    });
    this.#settleAction(invocationId);
    this.#pendingOutcomes.delete(invocationId);
    this.#setSubmitting(invocation.sourceSurfaceId, false);
    this.#publish(invocationId, "tool.invocationFailed", {
      error: actionError,
      resultSurfaceId: resultSurface.id,
    });
    this.#publish(invocationId, "result.surfaceCreated", {
      surfaceId: resultSurface.id,
      resultSurfaceId: resultSurface.id,
    });
    this.#publishActionForInvocation(invocationId);
    return invocation;
  }

  replaceToolSurface(
    invocationId: string,
    replacement: Omit<Surface, "id" | "revision">,
    aliases: SchemaFieldAliases = {},
  ): SurfaceDataMigrationResult {
    const invocation = this.#invocations.require(invocationId);
    const current = this.#surfaces.requireSurface(invocation.sourceSurfaceId);
    const candidate: Surface = {
      ...cloneValue(replacement),
      id: current.id,
      revision: current.revision + 1,
    };
    const migration = migrateSurfaceData(current, candidate, aliases);
    const migratedReplacement: Omit<Surface, "id" | "revision"> = {
      intent: migration.surface.intent,
      tree: migration.surface.tree,
      data: migration.surface.data,
      context: migration.surface.context,
      ...(migration.surface.schemaRef === undefined
        ? {}
        : { schemaRef: migration.surface.schemaRef }),
      ...(migration.surface.presentation === undefined
        ? {}
        : { presentation: migration.surface.presentation }),
    };
    const surface = this.#surfaces.replaceSurface(
      current.id,
      current.revision,
      migratedReplacement,
    );
    for (const conflict of migration.conflicts) {
      this.#publish(invocationId, "ui.dataMigrationConflict", {
        surfaceId: surface.id,
        details: cloneValue(conflict) as unknown as JsonObject,
      });
    }
    return { surface, conflicts: migration.conflicts };
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

  #submit(
    invocation: ToolInvocation,
    confirmed: boolean,
    intent: ActionIntent,
  ): ToolActionOutcome {
    const definition = this.#tools.require(
      invocation.toolId,
      invocation.toolVersion,
    );
    const confirmationRequired =
      definition.annotations?.sideEffect === true ||
      definition.annotations?.confirmation === "required";
    let current = invocation;
    let confirmation = this.#confirmations.get(invocation.id);
    if (
      confirmation !== undefined &&
      (this.#surfaces.requireSurface(current.sourceSurfaceId).revision !==
        confirmation.sourceRevision ||
        this.#surfaces.requireSurface(confirmation.surfaceId).revision !==
          confirmation.surfaceRevision)
    ) {
      this.#invalidateConfirmation(invocation.id);
      current = this.#invocations.require(invocation.id);
      confirmation = undefined;
    }
    if (confirmationRequired && confirmed) {
      if (
        current.status !== "awaiting-confirmation" ||
        confirmation === undefined ||
        intent.surfaceId !== confirmation.surfaceId ||
        intent.nodeId !==
          this.#surfaces.requireSurface(confirmation.surfaceId).tree.id
      ) {
        throw new DynamicUIError(
          "TOOL_CONFIRMATION_REQUIRED",
          "Submit through the active confirmation Surface for the current input",
        );
      }
      return this.#request(
        current.id,
        confirmation.argumentsValue,
        false,
        intent,
      );
    }
    if (confirmationRequired && confirmation !== undefined) {
      return {
        kind: "confirmation-required",
        invocation: current,
        confirmationSurface: this.#surfaces.requireSurface(
          confirmation.surfaceId,
        ),
      };
    }
    const argumentsValue = this.#validate(current);
    if (confirmationRequired) {
      const sourceRevision = this.#surfaces.requireSurface(
        current.sourceSurfaceId,
      ).revision;
      const confirmationSurface = this.#confirmationSurface(
        current,
        argumentsValue,
      );
      const awaiting = this.#invocations.transition(
        invocation.id,
        "awaiting-confirmation",
      );
      this.#confirmations.set(invocation.id, {
        surfaceId: confirmationSurface.id,
        surfaceRevision: confirmationSurface.revision,
        sourceRevision,
        argumentsValue: cloneValue(argumentsValue),
      });
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
    return this.#request(invocation.id, argumentsValue, false, intent);
  }

  #retry(invocation: ToolInvocation, intent: ActionIntent): ToolActionOutcome {
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
    const previousRequest = this.#lastRequests.get(invocation.id);
    if (previousRequest === undefined) {
      throw new DynamicUIError(
        "TOOL_RETRY_NOT_ALLOWED",
        `Tool "${definition.id}" has no original validated request to retry`,
      );
    }
    this.#publish(invocation.id, "tool.retryRequested");
    return this.#request(
      invocation.id,
      previousRequest.validatedArguments,
      true,
      intent,
    );
  }

  #invalidateConfirmation(invocationId: string): void {
    this.#confirmations.delete(invocationId);
    if (
      this.#invocations.require(invocationId).status === "awaiting-confirmation"
    ) {
      this.#invocations.transition(invocationId, "editing");
    }
  }

  #request(
    invocationId: string,
    argumentsValue: JsonObject,
    retry: boolean,
    intent: ActionIntent,
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
    this.#confirmations.delete(invocationId);
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
    this.#lastRequests.set(invocation.id, cloneValue(request));
    this.#recordAction(intent, false);
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
    for (const listener of this.#requestListeners) {
      try {
        listener(cloneValue(request));
      } catch (error) {
        this.#reportListenerError(error, "request", request);
      }
    }
    const outcome: ToolActionOutcome = {
      kind: "invocation-requested",
      invocation,
      request,
    };
    this.#pendingOutcomes.set(invocation.id, cloneValue(outcome));
    this.#publishActionState(intent.surfaceId);
    return outcome;
  }

  #confirmationSurface(
    invocation: ToolInvocation,
    argumentsValue: JsonObject,
  ): Surface {
    const prefix = `${invocation.sourceSurfaceId}--confirmation`;
    let surfaceId = prefix;
    while (this.#surfaces.getSurface(surfaceId) !== undefined) {
      this.#confirmationSequence += 1;
      surfaceId = `${prefix}-${this.#confirmationSequence}`;
    }
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

  #createResultSurface(
    invocation: ToolInvocation,
    result: JsonValue | undefined,
    status: "success" | "partial" | "error",
    errors: ActionError[] | undefined,
    retryable: boolean,
  ): Surface {
    const definition = this.#tools.require(
      invocation.toolId,
      invocation.toolVersion,
    );
    const surfaceId = `${invocation.sourceSurfaceId}--result-${invocation.attempt}`;
    const generated = generateResultSurface(
      {
        definition,
        surfaceId,
        invocationId: invocation.id,
        correlationId: invocation.correlationId,
        status,
        ...(result === undefined ? {} : { result }),
        ...(errors === undefined ? {} : { errors }),
        ...(retryable ? { retryable: true } : {}),
      },
      this.#components,
    );
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

  #recordAction(intent: ActionIntent, settled: boolean): void {
    this.#actionMetadata.set(
      this.#surfaceInvocations.get(intent.surfaceId) ??
        String(intentObject(intent).invocationId ?? ""),
      {
        intentId: intent.id,
        surfaceId: intent.surfaceId,
        nodeId: intent.nodeId,
        action: intent.action,
        startedAt: this.#now(),
        ...(settled ? { settledAt: this.#now() } : {}),
      },
    );
  }

  #settleAction(invocationId: string): void {
    const metadata = this.#actionMetadata.get(invocationId);
    if (metadata !== undefined && metadata.settledAt === undefined) {
      metadata.settledAt = this.#now();
    }
  }

  #projectActionState(invocationId: string): ActionExecutionState | undefined {
    const metadata = this.#actionMetadata.get(invocationId);
    if (metadata === undefined) return undefined;
    const invocation = this.#invocations.require(invocationId);
    const status =
      invocation.status === "submitting"
        ? "pending"
        : invocation.status === "success"
          ? "succeeded"
          : invocation.status === "error"
            ? "failed"
            : invocation.status === "cancelled"
              ? "cancelled"
              : undefined;
    if (status === undefined) return undefined;
    return {
      intentId: metadata.intentId,
      idempotencyKey: invocation.lastIdempotencyKey ?? metadata.intentId,
      surfaceId: metadata.surfaceId,
      nodeId: metadata.nodeId,
      action: metadata.action,
      status,
      attempt: invocation.attempt,
      startedAt: metadata.startedAt,
      ...(metadata.settledAt === undefined
        ? {}
        : { settledAt: metadata.settledAt }),
      ...(invocation.error === undefined ? {} : { error: invocation.error }),
    };
  }

  #actionSnapshot(surfaceId: string): ActionExecutionSnapshot {
    return cloneValue({
      surfaceId,
      interactionDisabled: this.#interactionDisabled.has(surfaceId),
      states: [...this.#actionMetadata]
        .filter(([, metadata]) => metadata.surfaceId === surfaceId)
        .map(([invocationId]) => this.#projectActionState(invocationId))
        .filter((state): state is ActionExecutionState => state !== undefined)
        .sort((left, right) =>
          left.idempotencyKey.localeCompare(right.idempotencyKey),
        ),
    });
  }

  #subscribeActionState(
    surfaceId: string,
    listener: ActionExecutionStateListener,
  ): () => void {
    const listeners =
      this.#actionListeners.get(surfaceId) ??
      new Set<ActionExecutionStateListener>();
    listeners.add(listener);
    this.#actionListeners.set(surfaceId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#actionListeners.delete(surfaceId);
    };
  }

  #publishActionState(surfaceId: string): void {
    const snapshot = this.#actionSnapshot(surfaceId);
    for (const listener of this.#actionListeners.get(surfaceId) ?? []) {
      try {
        listener(cloneValue(snapshot));
      } catch {
        // Action state is observational and cannot affect ToolInvocation.
      }
    }
  }

  #publishActionForInvocation(invocationId: string): void {
    const metadata = this.#actionMetadata.get(invocationId);
    if (metadata !== undefined) this.#publishActionState(metadata.surfaceId);
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
    for (const listener of this.#listeners) {
      try {
        listener(cloneValue(event));
      } catch (error) {
        this.#reportListenerError(error, "event", event);
      }
    }
  }

  #reportListenerError(
    error: unknown,
    channel: "event" | "request",
    payload: ToolRuntimeEvent | ToolSubmissionRequest,
  ): void {
    try {
      this.#onListenerError?.(error, channel, cloneValue(payload));
    } catch {
      // Error reporting is observational and must not alter Runtime state.
    }
  }

  /** Releases subscriptions and transient data for one completed host interaction. */
  disposeInvocation(invocationId: string): void {
    this.#invocations.require(invocationId);
    for (const [surfaceId, mappedInvocationId] of this.#surfaceInvocations) {
      if (mappedInvocationId !== invocationId) continue;
      this.#surfaceSubscriptions.get(surfaceId)?.();
      this.#surfaceSubscriptions.delete(surfaceId);
      this.#surfaceInvocations.delete(surfaceId);
    }
    this.#initialReadOnly.delete(invocationId);
    this.#rawResults.delete(invocationId);
    this.#lastRequests.delete(invocationId);
    this.#pendingOutcomes.delete(invocationId);
    this.#confirmations.delete(invocationId);
    const metadata = this.#actionMetadata.get(invocationId);
    if (metadata !== undefined) {
      this.#actionMetadata.delete(invocationId);
      this.#publishActionState(metadata.surfaceId);
    }
  }

  /** Releases every listener and transient association owned by this Runtime. */
  dispose(): void {
    for (const unsubscribe of this.#surfaceSubscriptions.values())
      unsubscribe();
    this.#surfaceSubscriptions.clear();
    this.#surfaceInvocations.clear();
    this.#initialReadOnly.clear();
    this.#rawResults.clear();
    this.#lastRequests.clear();
    this.#pendingOutcomes.clear();
    this.#confirmations.clear();
    this.#actionMetadata.clear();
    this.#actionListeners.clear();
    this.#interactionDisabled.clear();
    this.#listeners.clear();
    this.#requestListeners.clear();
  }

  #nextSequence(): number {
    this.#sequence += 1;
    return this.#sequence;
  }
}
