import Ajv2020 from "ajv/dist/2020.js";

import { cloneValue } from "./data.js";
import { DynamicUIError } from "./errors.js";
import type { DynamicUIErrorCode } from "./errors.js";
import type { JsonSchema, JsonValue } from "./types.js";

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
});

function validationMessage(
  errors: typeof ajv.errors,
  fallback: string,
): string {
  if (errors === null || errors === undefined || errors.length === 0) {
    return fallback;
  }
  return errors
    .map(
      (error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`,
    )
    .join("; ");
}

/** Compiles a JSON Schema 2020-12 document without exposing Ajv types. */
export function assertValidJsonSchema(
  schema: JsonSchema,
  label = "schema",
  code: DynamicUIErrorCode = "INVALID_COMPONENT_PACK",
): void {
  try {
    ajv.compile(cloneValue(schema));
  } catch (error) {
    throw new DynamicUIError(
      code,
      `${label} is not a valid JSON Schema 2020-12 document`,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

/** Validates a JSON value against a pack-owned schema. */
export function assertMatchesJsonSchema(
  schema: JsonSchema,
  value: JsonValue,
  label = "value",
  code: DynamicUIErrorCode = "INVALID_SURFACE",
): void {
  let validate: ReturnType<typeof ajv.compile>;
  try {
    validate = ajv.compile(cloneValue(schema));
  } catch (error) {
    throw new DynamicUIError(
      code,
      `Cannot validate ${label} because its schema is invalid`,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  if (!validate(value)) {
    throw new DynamicUIError(
      code,
      `${label} does not match its JSON Schema: ${validationMessage(validate.errors, "invalid value")}`,
    );
  }
}
