import { DynamicUIError } from "./errors.js";
import type { DynamicUIErrorCode } from "./errors.js";
import type {
  BindingValueType,
  DataBinding,
  JsonObject,
  JsonValue,
  UINode,
} from "./types.js";

const unsafePathSegments = new Set(["__proto__", "constructor", "prototype"]);
const unsafeDeclarationKeys = new Set([
  "__proto__",
  "antdprops",
  "classname",
  "code",
  "command",
  "constructor",
  "dangerouslysetinnerhtml",
  "eval",
  "function",
  "handler",
  "javascript",
  "prototype",
  "reactariaprops",
  "script",
]);
const executableString =
  /(?:javascript\s*:|<\s*script\b|\beval\s*\(|\bfunction\s*\(|=>|\bimport\s*\()/i;

export function cloneValue<T>(value: T): T {
  if (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      "Only plain JSON-compatible objects can be cloned",
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
  ) as T;
}

/** Validates the JSON data model without relying on DOM structured cloning. */
export function assertJsonValue(
  value: unknown,
  path = "value",
): asserts value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new DynamicUIError(
      "INVALID_SURFACE",
      `${path} contains a non-finite number`,
    );
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      `${path} must contain only plain JSON values`,
    );
  }
  for (const [key, item] of Object.entries(value)) {
    if (unsafePathSegments.has(key)) {
      throw new DynamicUIError(
        "INVALID_SURFACE",
        `${path}.${key} is not a safe JSON property`,
      );
    }
    assertJsonValue(item, `${path}.${key}`);
  }
}

/** Rejects framework props and executable-looking values from wire declarations. */
export function assertSafeDeclaration(
  value: unknown,
  path = "declaration",
  code: DynamicUIErrorCode = "INVALID_COMPONENT_PACK",
): asserts value is JsonValue {
  assertJsonValue(value, path);
  if (typeof value === "string") {
    if (executableString.test(value)) {
      throw new DynamicUIError(
        code,
        `${path} contains executable code-like text`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafeDeclaration(item, `${path}[${index}]`, code),
    );
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (unsafeDeclarationKeys.has(key.toLowerCase())) {
      throw new DynamicUIError(
        code,
        `${path}.${key} is a framework-specific or executable field`,
      );
    }
    assertSafeDeclaration(item, `${path}.${key}`, code);
  }
}

export function splitDataPath(path: string): string[] {
  const segments = path.split(".").filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => unsafePathSegments.has(segment))
  ) {
    throw new Error(`Invalid data path: ${path}`);
  }
  return segments;
}

export function bindingValueTypeMatches(
  valueType: BindingValueType,
  value: unknown,
): boolean {
  if (value === undefined || value === null || valueType === "unknown") {
    return true;
  }
  switch (valueType) {
    case "string":
    case "boolean":
      return typeof value === valueType;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && !Array.isArray(value);
  }
}

export function readDataPath(
  data: JsonObject,
  path: string,
): JsonValue | undefined {
  let current: unknown = data;
  for (const segment of splitDataPath(path)) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, JsonValue>)[segment];
  }
  return current as JsonValue | undefined;
}

export function writeDataPath(
  data: JsonObject,
  path: string,
  value: JsonValue,
): void {
  const segments = splitDataPath(path);
  let current = data;
  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment];
    if (
      typeof existing !== "object" ||
      existing === null ||
      Array.isArray(existing)
    ) {
      current[segment] = {};
    }
    current = current[segment] as JsonObject;
  }
  current[segments.at(-1) as string] = cloneValue(value);
}

export function collectBindings(root: UINode): Map<string, DataBinding> {
  const bindings = new Map<string, DataBinding>();
  walkNodes(root, (node) => {
    if (node.stableId !== undefined && node.binding !== undefined) {
      bindings.set(node.stableId, node.binding);
    }
  });
  return bindings;
}

export function bindingsAreCompatible(
  previous: DataBinding,
  next: DataBinding,
): boolean {
  const valueTypeMatches =
    previous.valueType === next.valueType ||
    previous.valueType === "unknown" ||
    next.valueType === "unknown";
  const semanticMatches =
    previous.semantic === undefined ||
    next.semantic === undefined ||
    previous.semantic === next.semantic;
  return valueTypeMatches && semanticMatches;
}

export function walkNodes(root: UINode, visit: (node: UINode) => void): void {
  visit(root);
  for (const child of root.children ?? []) {
    walkNodes(child, visit);
  }
}
