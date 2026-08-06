import { cloneValue, walkNodes } from "./data.js";
import { DynamicUIError } from "./errors.js";
import { assertMatchesJsonSchema } from "./json-schema.js";
import type {
  ActionIntent,
  ComponentRegistry,
  JsonValue,
  Surface,
  UINode,
} from "./types.js";

const executableKeys = new Set([
  "code",
  "command",
  "eval",
  "function",
  "handler",
  "javascript",
  "script",
]);

function assertSafeJson(
  value: unknown,
  path = "input",
): asserts value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new DynamicUIError(
        "INVALID_ACTION_INTENT",
        `${path} contains a non-finite number`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertSafeJson(item, `${path}[${index}]`);
    });
    return;
  }
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new DynamicUIError(
      "INVALID_ACTION_INTENT",
      `${path} must contain only plain JSON values`,
    );
  }
  for (const [key, item] of Object.entries(value)) {
    if (executableKeys.has(key.toLowerCase())) {
      throw new DynamicUIError(
        "INVALID_ACTION_INTENT",
        `${path}.${key} is an executable field and is not allowed`,
      );
    }
    assertSafeJson(item, `${path}.${key}`);
  }
}

function findNode(surface: Surface, nodeId: string): UINode | undefined {
  let result: UINode | undefined;
  walkNodes(surface.tree, (node) => {
    if (node.id === nodeId) {
      result = node;
    }
  });
  return result;
}

export interface CreateActionIntentInput {
  id: string;
  nodeId: string;
  action: string;
  input: unknown;
  idempotencyKey?: string;
}

/** Creates an ActionIntent only after node, action, and input validation. */
export function createActionIntent(
  registry: ComponentRegistry,
  surface: Surface,
  request: CreateActionIntentInput,
): ActionIntent {
  const node = findNode(surface, request.nodeId);
  if (node === undefined) {
    throw new DynamicUIError(
      "INVALID_ACTION_INTENT",
      `Node "${request.nodeId}" does not exist on surface "${surface.id}"`,
    );
  }
  registry.assertAction(node.component, request.action);
  assertSafeJson(request.input);
  const definition = registry.require(node.component);
  const action = (definition.actions ?? []).find((item) =>
    typeof item === "string"
      ? item === request.action
      : item.name === request.action,
  );
  if (typeof action === "object" && action.inputSchema !== undefined) {
    assertMatchesJsonSchema(
      action.inputSchema,
      request.input,
      `Input for action "${request.action}"`,
      "INVALID_ACTION_INTENT",
    );
  }
  if (definition.actionSchema !== undefined) {
    assertMatchesJsonSchema(
      definition.actionSchema,
      { action: request.action, input: request.input },
      `Action "${request.action}"`,
      "INVALID_ACTION_INTENT",
    );
  }
  const intent: ActionIntent = {
    id: request.id,
    surfaceId: surface.id,
    nodeId: node.id,
    action: request.action,
    input: cloneValue(request.input),
  };
  if (request.idempotencyKey !== undefined) {
    intent.idempotencyKey = request.idempotencyKey;
  }
  return intent;
}
