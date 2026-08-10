import { DynamicUIError } from "./errors.js";
import type {
  Surface,
  SurfaceResourceLimits,
  UIOperation,
  UINode,
} from "./types.js";

export const defaultSurfaceResourceLimits: SurfaceResourceLimits = {
  maxNodes: 2_000,
  maxTreeDepth: 64,
  maxOperationsPerBatch: 100,
  maxJsonDepth: 128,
  maxJsonValues: 50_000,
  maxStringLength: 100_000,
};

export function resolveSurfaceResourceLimits(
  limits: Partial<SurfaceResourceLimits> = {},
): SurfaceResourceLimits {
  const resolved = { ...defaultSurfaceResourceLimits, ...limits };
  for (const [name, value] of Object.entries(resolved)) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new DynamicUIError(
        "RESOURCE_LIMIT_EXCEEDED",
        `${name} must be a positive integer`,
      );
    }
  }
  return resolved;
}

function resourceLimit(message: string): never {
  throw new DynamicUIError("RESOURCE_LIMIT_EXCEEDED", message);
}

function assertJsonBudget(
  value: unknown,
  limits: SurfaceResourceLimits,
  label: string,
): void {
  const stack: Array<{ value: unknown; depth: number; leaving?: boolean }> = [
    { value, depth: 0 },
  ];
  const ancestors = new WeakSet<object>();
  let count = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    if (current.leaving === true) {
      if (typeof current.value === "object" && current.value !== null) {
        ancestors.delete(current.value);
      }
      continue;
    }
    count += 1;
    if (count > limits.maxJsonValues) {
      resourceLimit(`${label} exceeds ${limits.maxJsonValues} JSON values`);
    }
    if (current.depth > limits.maxJsonDepth) {
      resourceLimit(`${label} exceeds JSON depth ${limits.maxJsonDepth}`);
    }
    if (
      typeof current.value === "string" &&
      current.value.length > limits.maxStringLength
    ) {
      resourceLimit(
        `${label} contains a string longer than ${limits.maxStringLength} characters`,
      );
    }
    if (typeof current.value !== "object" || current.value === null) continue;
    if (ancestors.has(current.value)) {
      throw new DynamicUIError(
        "INVALID_SURFACE",
        `${label} must not contain cyclic objects`,
      );
    }
    ancestors.add(current.value);
    stack.push({ ...current, leaving: true });
    const values = Array.isArray(current.value)
      ? current.value
      : Object.entries(current.value).flatMap(([key, item]) => [key, item]);
    for (const item of values) {
      stack.push({ value: item, depth: current.depth + 1 });
    }
  }
}

function assertTreeBudget(root: UINode, limits: SurfaceResourceLimits): void {
  const stack: Array<{ node: UINode; depth: number }> = [
    { node: root, depth: 1 },
  ];
  let count = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    count += 1;
    if (count > limits.maxNodes) {
      resourceLimit(`Surface exceeds ${limits.maxNodes} UI nodes`);
    }
    if (current.depth > limits.maxTreeDepth) {
      resourceLimit(`Surface exceeds tree depth ${limits.maxTreeDepth}`);
    }
    for (const child of current.node.children ?? []) {
      stack.push({ node: child, depth: current.depth + 1 });
    }
  }
}

export function assertSurfaceResourceLimits(
  surface: Surface,
  limits: SurfaceResourceLimits,
): void {
  assertJsonBudget(surface, limits, "Surface");
  assertTreeBudget(surface.tree, limits);
}

export function assertOperationResourceLimits(
  operations: UIOperation[],
  limits: SurfaceResourceLimits,
): void {
  if (operations.length > limits.maxOperationsPerBatch) {
    resourceLimit(
      `Operation batch exceeds ${limits.maxOperationsPerBatch} entries`,
    );
  }
  assertJsonBudget(operations, limits, "Operation batch");
}
