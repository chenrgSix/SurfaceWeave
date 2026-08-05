import { DynamicUIError, cloneValue } from "@package-first/core";
import type {
  JsonValue,
  PreferenceDocument,
  PreferenceOperation,
  PreferencePatch,
  PreferenceScope,
  SchemaRef,
  UIIntent,
} from "@package-first/core";

function record(value: unknown, label: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      `${label} must be an object`,
    );
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      `${label} must be a non-empty string`,
    );
  }
  return value;
}

function jsonValue(value: unknown, label: string): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => jsonValue(item, `${label}[${index}]`));
  }
  const object = record(value, label);
  return Object.fromEntries(
    Object.entries(object).map(([key, item]) => [
      key,
      jsonValue(item, `${label}.${key}`),
    ]),
  );
}

function schemaRef(value: unknown, label: string): SchemaRef {
  const object = record(value, label);
  const result: SchemaRef = { id: nonEmptyString(object.id, `${label}.id`) };
  if (object.version !== undefined) {
    result.version = nonEmptyString(object.version, `${label}.version`);
  }
  return result;
}

function operation(
  value: unknown,
  targetStableId: string,
): PreferenceOperation {
  const object = record(value, "preference.operation");
  const type = nonEmptyString(object.type, "preference.operation.type");
  const target = nonEmptyString(object.target, "preference.operation.target");
  if (target !== targetStableId) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Preference operation target must equal targetStableId",
    );
  }
  switch (type) {
    case "moveNode": {
      const position = object.position;
      if (
        position !== "first" &&
        position !== "last" &&
        (typeof position !== "number" ||
          !Number.isInteger(position) ||
          position < 0)
      ) {
        throw new DynamicUIError(
          "INVALID_PREFERENCE",
          "moveNode position is invalid",
        );
      }
      const parsed: PreferenceOperation = { type, target, position };
      if (object.parent !== undefined) {
        parsed.parent = nonEmptyString(
          object.parent,
          "preference.operation.parent",
        );
      }
      return parsed;
    }
    case "replaceComponent": {
      const parsed: PreferenceOperation = {
        type,
        target,
        component: nonEmptyString(
          object.component,
          "preference.operation.component",
        ),
      };
      if (object.props !== undefined) {
        parsed.props = jsonValue(
          object.props,
          "preference.operation.props",
        ) as Record<string, JsonValue>;
      }
      if (object.binding !== undefined) {
        throw new DynamicUIError(
          "INVALID_PREFERENCE",
          "Preference component replacement cannot rewrite data bindings",
        );
      }
      return parsed;
    }
    case "setProps":
      if (object.replace !== undefined && typeof object.replace !== "boolean") {
        throw new DynamicUIError(
          "INVALID_PREFERENCE",
          "setProps replace must be boolean",
        );
      }
      return {
        type,
        target,
        props: jsonValue(object.props, "preference.operation.props") as Record<
          string,
          JsonValue
        >,
        ...(object.replace === undefined ? {} : { replace: object.replace }),
      };
    case "setLayout":
      return {
        type,
        target,
        layout: jsonValue(
          object.layout,
          "preference.operation.layout",
        ) as Record<string, JsonValue>,
      };
    case "setVisibility":
      if (typeof object.visible !== "boolean") {
        throw new DynamicUIError(
          "INVALID_PREFERENCE",
          "setVisibility visible must be boolean",
        );
      }
      return { type, target, visible: object.visible };
    default:
      throw new DynamicUIError(
        "INVALID_PREFERENCE",
        `Operation "${type}" cannot be stored as a preference`,
      );
  }
}

const scopes: PreferenceScope[] = ["global", "intent", "tool"];
const intents: UIIntent[] = [
  "form",
  "browse",
  "single-select",
  "multi-select",
  "confirm",
];

export function parsePreferencePatch(value: unknown): PreferencePatch {
  const object = record(value, "preference");
  const scope = object.scope as PreferenceScope;
  if (!scopes.includes(scope)) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Preference scope is invalid",
    );
  }
  const targetStableId = nonEmptyString(
    object.targetStableId,
    "preference.targetStableId",
  );
  const patch: PreferencePatch = {
    id: nonEmptyString(object.id, "preference.id"),
    scope,
    targetStableId,
    operation: operation(object.operation, targetStableId),
  };
  if (object.schemaRef !== undefined) {
    patch.schemaRef = schemaRef(object.schemaRef, "preference.schemaRef");
  }
  if (object.intent !== undefined) {
    if (!intents.includes(object.intent as UIIntent)) {
      throw new DynamicUIError(
        "INVALID_PREFERENCE",
        "Preference intent is invalid",
      );
    }
    patch.intent = object.intent as UIIntent;
  }
  if (object.toolId !== undefined) {
    patch.toolId = nonEmptyString(object.toolId, "preference.toolId");
  }
  if (scope === "intent" && patch.intent === undefined) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Intent-scoped preference requires intent",
    );
  }
  if (scope === "tool" && patch.toolId === undefined) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Tool-scoped preference requires toolId",
    );
  }
  if (scope === "intent" && patch.toolId !== undefined) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Intent-scoped preference cannot declare toolId",
    );
  }
  if (scope === "tool" && patch.intent !== undefined) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Tool-scoped preference cannot declare intent",
    );
  }
  if (
    scope === "global" &&
    (patch.intent !== undefined || patch.toolId !== undefined)
  ) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Global preference cannot declare intent or toolId",
    );
  }
  return cloneValue(patch);
}

export function parsePreferenceDocument(value: unknown): PreferenceDocument {
  const object = record(value, "preference document");
  if (object.version !== 1 || !Array.isArray(object.patches)) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Preference document must use version 1 and contain patches",
    );
  }
  const patches = object.patches.map(parsePreferencePatch);
  if (new Set(patches.map((patch) => patch.id)).size !== patches.length) {
    throw new DynamicUIError(
      "INVALID_PREFERENCE",
      "Preference ids must be unique",
    );
  }
  return { version: 1, patches };
}
