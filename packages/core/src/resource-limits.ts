import { DynamicUIError } from "./errors.js";
import type { SurfaceResourcePolicySummary } from "./client-capabilities.js";
import type {
  Surface,
  SurfaceResourceLimits,
  SurfaceResourcePolicy,
  UIOperation,
  UINode,
} from "./types.js";

export const recommendedSurfaceResourcePolicy: SurfaceResourcePolicy = {
  maxNodes: 2_000,
  maxTreeDepth: 64,
  maxOperationsPerBatch: 100,
  maxJsonDepth: 128,
  maxJsonValues: 50_000,
  maxStringLength: 100_000,
  maxSurfaceBytes: 2_000_000,
};

/** @deprecated Use recommendedSurfaceResourcePolicy. */
export const defaultSurfaceResourceLimits: SurfaceResourceLimits =
  recommendedSurfaceResourcePolicy;

export function resolveSurfaceResourcePolicy(
  policy: Partial<SurfaceResourcePolicy> = {},
): SurfaceResourcePolicy {
  const resolved = { ...recommendedSurfaceResourcePolicy, ...policy };
  for (const [name, value] of Object.entries(resolved)) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new DynamicUIError(
        "INVALID_RESOURCE_POLICY",
        `${name} must be a positive integer`,
        { limit: name, actual: value },
      );
    }
  }
  return resolved;
}

/** @deprecated Use resolveSurfaceResourcePolicy. */
export const resolveSurfaceResourceLimits = resolveSurfaceResourcePolicy;

export function createSurfaceResourcePolicySummary(
  policy?: Partial<SurfaceResourcePolicy>,
): SurfaceResourcePolicySummary {
  return policy === undefined
    ? { enabled: false }
    : { enabled: true, limits: resolveSurfaceResourcePolicy(policy) };
}

function resourceLimit(
  limit: keyof SurfaceResourcePolicy,
  allowed: number,
  actual: number,
  scope: string,
): never {
  throw new DynamicUIError(
    "RESOURCE_POLICY_EXCEEDED",
    `${scope} exceeds ${limit}: allowed ${allowed}, received ${actual}`,
    { limit, allowed, actual, scope },
  );
}

function assertPlainObject(value: object, label: string): void {
  if (Array.isArray(value)) return;
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      `${label} must contain only plain JSON objects`,
    );
  }
}

function assertJsonBudget(
  value: unknown,
  policy: SurfaceResourcePolicy | undefined,
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
    if (policy !== undefined && count > policy.maxJsonValues) {
      resourceLimit("maxJsonValues", policy.maxJsonValues, count, label);
    }
    if (policy !== undefined && current.depth > policy.maxJsonDepth) {
      resourceLimit("maxJsonDepth", policy.maxJsonDepth, current.depth, label);
    }
    if (
      policy !== undefined &&
      typeof current.value === "string" &&
      current.value.length > policy.maxStringLength
    ) {
      resourceLimit(
        "maxStringLength",
        policy.maxStringLength,
        current.value.length,
        label,
      );
    }
    if (typeof current.value !== "object" || current.value === null) continue;
    assertPlainObject(current.value, label);
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
    for (let index = values.length - 1; index >= 0; index -= 1) {
      stack.push({ value: values[index], depth: current.depth + 1 });
    }
  }
}

function assertTreeBudget(
  root: UINode,
  policy: SurfaceResourcePolicy | undefined,
): void {
  const stack: Array<{ node: UINode; depth: number }> = [
    { node: root, depth: 1 },
  ];
  let count = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    count += 1;
    if (policy !== undefined && count > policy.maxNodes) {
      resourceLimit("maxNodes", policy.maxNodes, count, "Surface");
    }
    if (policy !== undefined && current.depth > policy.maxTreeDepth) {
      resourceLimit(
        "maxTreeDepth",
        policy.maxTreeDepth,
        current.depth,
        "Surface",
      );
    }
    const children = current.node.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) {
        stack.push({ node: child, depth: current.depth + 1 });
      }
    }
  }
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/** Always checks structure; numeric budgets are applied only when enabled. */
export function assertSurfaceResourcePolicy(
  surface: Surface,
  policy?: SurfaceResourcePolicy,
): void {
  assertJsonBudget(surface, policy, "Surface");
  assertTreeBudget(surface.tree, policy);
  if (policy !== undefined) {
    const serialized = JSON.stringify(surface);
    const bytes = utf8Bytes(serialized);
    if (bytes > policy.maxSurfaceBytes) {
      resourceLimit(
        "maxSurfaceBytes",
        policy.maxSurfaceBytes,
        bytes,
        "Surface",
      );
    }
  }
}

/** @deprecated Use assertSurfaceResourcePolicy. */
export const assertSurfaceResourceLimits = assertSurfaceResourcePolicy;

export function assertOperationResourcePolicy(
  operations: UIOperation[],
  policy?: SurfaceResourcePolicy,
): void {
  if (
    policy !== undefined &&
    operations.length > policy.maxOperationsPerBatch
  ) {
    resourceLimit(
      "maxOperationsPerBatch",
      policy.maxOperationsPerBatch,
      operations.length,
      "Operation batch",
    );
  }
  assertJsonBudget(operations, policy, "Operation batch");
}

/** @deprecated Use assertOperationResourcePolicy. */
export const assertOperationResourceLimits = assertOperationResourcePolicy;
