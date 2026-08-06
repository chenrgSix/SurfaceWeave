import { parsePreferencePatch } from "@surfaceweave/preferences";

import type {
  DiscardPreferenceToolInput,
  InspectPreferencesToolInput,
  MigratePreferenceToolInput,
  SavePreferenceToolInput,
} from "./types.js";
import { ToolInputError } from "./validation.js";

function record(value: unknown, path: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new ToolInputError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function allowedKeys(
  value: Record<string, unknown>,
  keys: string[],
  path: string,
): void {
  const allowed = new Set(keys);
  const extra = Object.keys(value).find((key) => !allowed.has(key));
  if (extra !== undefined) {
    throw new ToolInputError(`${path}.${extra} is not supported`);
  }
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ToolInputError(`${path} must be a non-empty string`);
  }
  return value;
}

export function parseInspectPreferences(
  value: unknown,
): InspectPreferencesToolInput {
  const object = record(value, "arguments");
  allowedKeys(object, [], "arguments");
  return {};
}

export function parseSavePreference(value: unknown): SavePreferenceToolInput {
  const object = record(value, "arguments");
  allowedKeys(object, ["confirmed", "preference"], "arguments");
  if (object.confirmed !== true) {
    throw new ToolInputError(
      "arguments.confirmed must be true before saving a long-term preference",
    );
  }
  return {
    confirmed: true,
    preference: parsePreferencePatch(object.preference),
  };
}

export function parseMigratePreference(
  value: unknown,
): MigratePreferenceToolInput {
  const object = record(value, "arguments");
  allowedKeys(object, ["conflictId", "targetStableId"], "arguments");
  return {
    conflictId: stringValue(object.conflictId, "arguments.conflictId"),
    targetStableId: stringValue(
      object.targetStableId,
      "arguments.targetStableId",
    ),
  };
}

export function parseDiscardPreference(
  value: unknown,
): DiscardPreferenceToolInput {
  const object = record(value, "arguments");
  allowedKeys(object, ["conflictId"], "arguments");
  return {
    conflictId: stringValue(object.conflictId, "arguments.conflictId"),
  };
}
