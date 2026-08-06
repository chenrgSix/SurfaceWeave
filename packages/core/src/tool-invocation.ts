import { cloneValue } from "./data.js";
import { DynamicUIError } from "./errors.js";
import type {
  ToolInvocation,
  ToolInvocationStatus,
  ToolInvocationStore,
} from "./types.js";

const transitions: Record<ToolInvocationStatus, ToolInvocationStatus[]> = {
  idle: ["editing", "cancelled"],
  editing: ["validating", "cancelled"],
  validating: ["editing", "awaiting-confirmation", "submitting", "error"],
  "awaiting-confirmation": ["editing", "submitting", "cancelled"],
  submitting: ["success", "error", "cancelled"],
  success: [],
  error: ["editing", "validating", "submitting", "cancelled"],
  cancelled: [],
};

function validateInvocation(invocation: ToolInvocation): void {
  for (const [label, value] of [
    ["id", invocation.id],
    ["toolId", invocation.toolId],
    ["toolVersion", invocation.toolVersion],
    ["sourceSurfaceId", invocation.sourceSurfaceId],
    ["correlationId", invocation.correlationId],
  ] as Array<[string, string]>) {
    if (value.trim() === "") {
      throw new DynamicUIError(
        "INVALID_INVOCATION_TRANSITION",
        `Invocation ${label} cannot be empty`,
      );
    }
  }
}

/** Framework-neutral state owner for serializable Tool invocations. */
export class InMemoryToolInvocationStore implements ToolInvocationStore {
  readonly #invocations = new Map<string, ToolInvocation>();

  create(
    input: Omit<ToolInvocation, "revision" | "attempt"> & {
      revision?: number;
      attempt?: number;
    },
  ): ToolInvocation {
    if (this.#invocations.has(input.id)) {
      throw new DynamicUIError(
        "INVOCATION_EXISTS",
        `Invocation "${input.id}" already exists`,
      );
    }
    const invocation: ToolInvocation = {
      ...cloneValue(input),
      revision: 0,
      attempt: input.attempt ?? 0,
    };
    validateInvocation(invocation);
    this.#invocations.set(invocation.id, invocation);
    return cloneValue(invocation);
  }

  get(invocationId: string): ToolInvocation | undefined {
    const invocation = this.#invocations.get(invocationId);
    return invocation === undefined ? undefined : cloneValue(invocation);
  }

  require(invocationId: string): ToolInvocation {
    const invocation = this.get(invocationId);
    if (invocation === undefined) {
      throw new DynamicUIError(
        "INVOCATION_NOT_FOUND",
        `Invocation "${invocationId}" does not exist`,
      );
    }
    return invocation;
  }

  list(): ToolInvocation[] {
    return [...this.#invocations.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((invocation) => cloneValue(invocation));
  }

  transition(
    invocationId: string,
    status: ToolInvocationStatus,
    patch: Partial<
      Pick<
        ToolInvocation,
        "resultSurfaceId" | "lastIdempotencyKey" | "error" | "attempt"
      >
    > = {},
  ): ToolInvocation {
    const current = this.require(invocationId);
    if (!transitions[current.status].includes(status)) {
      throw new DynamicUIError(
        "INVALID_INVOCATION_TRANSITION",
        `Invocation "${invocationId}" cannot transition from ${current.status} to ${status}`,
      );
    }
    const next: ToolInvocation = {
      ...current,
      ...cloneValue(patch),
      status,
      revision: current.revision + 1,
    };
    validateInvocation(next);
    this.#invocations.set(invocationId, next);
    return cloneValue(next);
  }
}
