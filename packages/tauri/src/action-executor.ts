import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { cloneValue } from "@package-first/core";
import type {
  ActionExecutor,
  ActionIntent,
  ActionResult,
  JsonValue,
} from "@package-first/core";

export type TauriInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export interface TauriActionContext {
  readonly intent: ActionIntent;
  readonly invoke: TauriInvoke;
}

export type TauriActionHandler = (
  input: JsonValue,
  context: TauriActionContext,
) => Promise<JsonValue | undefined> | JsonValue | undefined;

export interface TauriActionRegistrationOptions {
  validate?: (input: JsonValue, intent: ActionIntent) => void;
  authorize?: (intent: ActionIntent) => boolean | Promise<boolean>;
}

interface RegisteredAction {
  handler: TauriActionHandler;
  options: TauriActionRegistrationOptions;
}

const forbiddenInputKeys = new Set([
  "code",
  "command",
  "eval",
  "function",
  "handler",
  "javascript",
  "rustcommand",
  "script",
  "shell",
  "url",
]);

function assertJsonValue(
  value: unknown,
  path: string,
  rejectControlKeys: boolean,
): asserts value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return;
    }
    throw new Error(`${path} contains a non-finite number`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertJsonValue(item, `${path}[${index}]`, rejectControlKeys),
    );
    return;
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(`${path} must contain plain JSON values`);
  }
  for (const [key, item] of Object.entries(value)) {
    if (rejectControlKeys && forbiddenInputKeys.has(key.toLowerCase())) {
      throw new Error(`${path}.${key} is not accepted by the Tauri adapter`);
    }
    assertJsonValue(item, `${path}.${key}`, rejectControlKeys);
  }
}

function errorResult(
  intent: ActionIntent,
  code: string,
  message: string,
): ActionResult {
  return {
    intentId: intent.id,
    status: "error",
    error: { code, message },
  };
}

/**
 * Executes only host-registered semantic actions. Trusted handlers may call
 * explicit Rust commands; ActionIntent values never select command names.
 */
export class TauriActionExecutor implements ActionExecutor {
  readonly #invoke: TauriInvoke;
  readonly #actions = new Map<string, RegisteredAction>();

  constructor(invoke: TauriInvoke = tauriInvoke as TauriInvoke) {
    this.#invoke = invoke;
  }

  register(
    action: string,
    handler: TauriActionHandler,
    options: TauriActionRegistrationOptions = {},
  ): void {
    if (action.trim() === "") {
      throw new Error("Tauri action name must be non-empty");
    }
    if (this.#actions.has(action)) {
      throw new Error(`Tauri action "${action}" is already registered`);
    }
    this.#actions.set(action, { handler, options });
  }

  unregister(action: string): boolean {
    return this.#actions.delete(action);
  }

  listActions(): string[] {
    return [...this.#actions.keys()].sort();
  }

  async execute(intent: ActionIntent): Promise<ActionResult> {
    const registered = this.#actions.get(intent.action);
    if (registered === undefined) {
      return errorResult(
        intent,
        "UNKNOWN_ACTION",
        `Action "${intent.action}" is not registered by the Tauri host`,
      );
    }
    try {
      assertJsonValue(intent.input, "input", true);
      registered.options.validate?.(intent.input, intent);
    } catch {
      return errorResult(
        intent,
        "INVALID_ACTION_INPUT",
        `Action "${intent.action}" received invalid input`,
      );
    }
    try {
      if ((await registered.options.authorize?.(intent)) === false) {
        return errorResult(
          intent,
          "ACTION_NOT_AUTHORIZED",
          `Action "${intent.action}" is not authorized`,
        );
      }
    } catch {
      return errorResult(
        intent,
        "ACTION_AUTHORIZATION_FAILED",
        `Authorization failed for action "${intent.action}"`,
      );
    }
    try {
      const safeIntent = cloneValue(intent);
      const output = await registered.handler(cloneValue(intent.input), {
        intent: safeIntent,
        invoke: this.#invoke,
      });
      if (output !== undefined) {
        assertJsonValue(output, "output", false);
      }
      return {
        intentId: intent.id,
        status: "success",
        ...(output === undefined ? {} : { output: cloneValue(output) }),
      };
    } catch {
      return errorResult(
        intent,
        "ACTION_HANDLER_FAILED",
        `Action "${intent.action}" failed in its registered handler`,
      );
    }
  }
}
