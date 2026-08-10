import { cloneValue } from "./data.js";
import { DynamicUIError } from "./errors.js";
import type {
  ActionError,
  ActionExecutor,
  ActionIntent,
  ActionResult,
} from "./types.js";

export type ActionExecutionStatus =
  "pending" | "succeeded" | "failed" | "cancelled";

/** Read-only execution projection exposed to renderers and host observers. */
export interface ActionExecutionState {
  intentId: string;
  idempotencyKey: string;
  surfaceId: string;
  nodeId: string;
  action: string;
  status: ActionExecutionStatus;
  attempt: number;
  startedAt: number;
  settledAt?: number;
  error?: ActionError;
}

export interface ActionExecutionSnapshot {
  surfaceId: string;
  interactionDisabled: boolean;
  states: ActionExecutionState[];
}

export type ActionExecutionStateListener = (
  snapshot: ActionExecutionSnapshot,
) => void;

/** Framework-neutral read-only source; implementations retain mutation authority. */
export interface ActionExecutionStateSource {
  getSnapshot(surfaceId: string): ActionExecutionSnapshot;
  subscribe(
    surfaceId: string,
    listener: ActionExecutionStateListener,
  ): () => void;
}

export type ActionExecutionListenerErrorHandler = (
  error: unknown,
  snapshot: ActionExecutionSnapshot,
) => void;

export interface InMemoryActionExecutionControllerOptions {
  now?: () => number;
  onListenerError?: ActionExecutionListenerErrorHandler;
}

interface ActionRecord {
  intent: ActionIntent;
  state: ActionExecutionState;
  promise: Promise<ActionResult>;
  result?: ActionResult;
  cancel?: (result: ActionResult) => void;
}

function executionKey(intent: ActionIntent): string {
  const key = intent.idempotencyKey ?? intent.id;
  if (key.trim() === "") {
    throw new DynamicUIError(
      "INVALID_ACTION_INTENT",
      "Action idempotency key cannot be empty",
    );
  }
  return key;
}

function normalizedResult(
  intent: ActionIntent,
  result: ActionResult,
): ActionResult {
  if (result.intentId !== intent.id) {
    return {
      intentId: intent.id,
      status: "error",
      error: {
        code: "ACTION_RESULT_MISMATCH",
        message: `ActionResult intentId must be "${intent.id}"`,
      },
    };
  }
  return cloneValue(result);
}

/**
 * Host-owned execution coordinator for non-Tool actions. Tool actions remain
 * authoritative in ToolInvocation and should use its read-only projection.
 */
export class InMemoryActionExecutionController implements ActionExecutionStateSource {
  readonly #executor: ActionExecutor;
  readonly #records = new Map<string, ActionRecord>();
  readonly #listeners = new Map<string, Set<ActionExecutionStateListener>>();
  readonly #disabled = new Set<string>();
  readonly #now: () => number;
  readonly #onListenerError: ActionExecutionListenerErrorHandler | undefined;

  constructor(
    executor: ActionExecutor,
    options: InMemoryActionExecutionControllerOptions = {},
  ) {
    this.#executor = executor;
    this.#now = options.now ?? Date.now;
    this.#onListenerError = options.onListenerError;
  }

  getSnapshot(surfaceId: string): ActionExecutionSnapshot {
    return cloneValue({
      surfaceId,
      interactionDisabled: this.#disabled.has(surfaceId),
      states: [...this.#records.values()]
        .filter((record) => record.state.surfaceId === surfaceId)
        .map((record) => record.state)
        .sort((left, right) =>
          left.idempotencyKey.localeCompare(right.idempotencyKey),
        ),
    });
  }

  subscribe(
    surfaceId: string,
    listener: ActionExecutionStateListener,
  ): () => void {
    const listeners =
      this.#listeners.get(surfaceId) ?? new Set<ActionExecutionStateListener>();
    listeners.add(listener);
    this.#listeners.set(surfaceId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(surfaceId);
    };
  }

  setInteractionDisabled(surfaceId: string, disabled: boolean): void {
    if (disabled) this.#disabled.add(surfaceId);
    else this.#disabled.delete(surfaceId);
    this.#publish(surfaceId);
  }

  execute(intent: ActionIntent): Promise<ActionResult> {
    if (this.#disabled.has(intent.surfaceId)) {
      return Promise.resolve({
        intentId: intent.id,
        status: "error",
        error: {
          code: "ACTION_INTERACTION_DISABLED",
          message: `Actions are temporarily disabled for Surface "${intent.surfaceId}"`,
        },
      });
    }
    const key = executionKey(intent);
    const existing = this.#records.get(key);
    if (existing !== undefined) return existing.promise;
    return this.#start(cloneValue(intent), key, 1);
  }

  retry(idempotencyKey: string): Promise<ActionResult> {
    const record = this.#records.get(idempotencyKey);
    if (record === undefined || record.state.status !== "failed") {
      throw new DynamicUIError(
        "ACTION_RETRY_NOT_ALLOWED",
        `Action "${idempotencyKey}" is not available for retry`,
      );
    }
    return this.#start(
      cloneValue(record.intent),
      idempotencyKey,
      record.state.attempt + 1,
    );
  }

  cancel(idempotencyKey: string): ActionResult {
    const record = this.#records.get(idempotencyKey);
    if (record === undefined || record.state.status !== "pending") {
      throw new DynamicUIError(
        "ACTION_CANCEL_NOT_ALLOWED",
        `Action "${idempotencyKey}" is not pending`,
      );
    }
    const result: ActionResult = {
      intentId: record.intent.id,
      status: "cancelled",
    };
    record.result = result;
    record.state = {
      ...record.state,
      status: "cancelled",
      settledAt: this.#now(),
    };
    record.cancel?.(cloneValue(result));
    delete record.cancel;
    this.#publish(record.state.surfaceId);
    return cloneValue(result);
  }

  dispose(): void {
    this.#listeners.clear();
    this.#records.clear();
    this.#disabled.clear();
  }

  #start(
    intent: ActionIntent,
    key: string,
    attempt: number,
  ): Promise<ActionResult> {
    let cancel: ((result: ActionResult) => void) | undefined;
    const cancelled = new Promise<ActionResult>((resolve) => {
      cancel = resolve;
    });
    const state: ActionExecutionState = {
      intentId: intent.id,
      idempotencyKey: key,
      surfaceId: intent.surfaceId,
      nodeId: intent.nodeId,
      action: intent.action,
      status: "pending",
      attempt,
      startedAt: this.#now(),
    };
    const record: ActionRecord = {
      intent,
      state,
      promise: Promise.resolve({ intentId: intent.id, status: "cancelled" }),
      ...(cancel === undefined ? {} : { cancel }),
    };
    let execution: Promise<ActionResult>;
    try {
      execution = Promise.resolve(this.#executor.execute(cloneValue(intent)));
    } catch (error) {
      execution = Promise.reject(error);
    }
    const executed = execution.then(
      (result) => normalizedResult(intent, result),
      (error: unknown): ActionResult => ({
        intentId: intent.id,
        status: "error",
        error: {
          code: "ACTION_EXECUTOR_REJECTED",
          message: error instanceof Error ? error.message : String(error),
        },
      }),
    );
    record.promise = Promise.race([executed, cancelled]).then((result) => {
      if (record.state.status === "cancelled") {
        return cloneValue(record.result ?? result);
      }
      record.result = cloneValue(result);
      record.state = {
        ...record.state,
        status:
          result.status === "success"
            ? "succeeded"
            : result.status === "cancelled"
              ? "cancelled"
              : "failed",
        settledAt: this.#now(),
        ...(result.error === undefined ? {} : { error: result.error }),
      };
      delete record.cancel;
      this.#publish(intent.surfaceId);
      return cloneValue(result);
    });
    this.#records.set(key, record);
    this.#publish(intent.surfaceId);
    return record.promise;
  }

  #publish(surfaceId: string): void {
    const snapshot = this.getSnapshot(surfaceId);
    for (const listener of this.#listeners.get(surfaceId) ?? []) {
      try {
        listener(cloneValue(snapshot));
      } catch (error) {
        try {
          this.#onListenerError?.(error, cloneValue(snapshot));
        } catch {
          // Observer reporting must not affect execution state.
        }
      }
    }
  }
}
