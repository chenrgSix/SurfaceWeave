import type { BindingValueType, DataBinding, UINode } from "./types.js";

const unsafePathSegments = new Set(["__proto__", "constructor", "prototype"]);

export function cloneValue<T>(value: T): T {
  return structuredClone(value);
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
  data: Record<string, unknown>,
  path: string,
): unknown {
  let current: unknown = data;
  for (const segment of splitDataPath(path)) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function writeDataPath(
  data: Record<string, unknown>,
  path: string,
  value: unknown,
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
    current = current[segment] as Record<string, unknown>;
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
