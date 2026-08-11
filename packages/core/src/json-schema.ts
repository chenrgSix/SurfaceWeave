import { Validator } from "@cfworker/json-schema";

import { cloneValue } from "./data.js";
import { DynamicUIError } from "./errors.js";
import type { DynamicUIErrorCode } from "./errors.js";
import type { JsonObject, JsonSchema, JsonValue } from "./types.js";

type ValidationError = {
  instanceLocation: string;
  error: string;
};

const schemaRef = { $ref: "#/$defs/schema" };
const schemaArray = {
  type: "array",
  minItems: 1,
  items: schemaRef,
};

/**
 * CSP-safe structural meta-schema for the JSON Schema keywords accepted by the
 * SDK. Unknown annotation and extension keywords remain legal, as required by
 * JSON Schema's vocabulary model.
 */
const schemaDocumentSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $defs: {
    schema: {
      anyOf: [
        { type: "boolean" },
        {
          type: "object",
          additionalProperties: true,
          properties: {
            $schema: { type: "string" },
            $id: { type: "string" },
            $ref: { type: "string" },
            $anchor: { type: "string" },
            type: {
              anyOf: [
                {
                  enum: [
                    "null",
                    "boolean",
                    "object",
                    "array",
                    "number",
                    "string",
                    "integer",
                  ],
                },
                {
                  type: "array",
                  minItems: 1,
                  uniqueItems: true,
                  items: {
                    enum: [
                      "null",
                      "boolean",
                      "object",
                      "array",
                      "number",
                      "string",
                      "integer",
                    ],
                  },
                },
              ],
            },
            enum: { type: "array", minItems: 1 },
            required: {
              type: "array",
              uniqueItems: true,
              items: { type: "string" },
            },
            properties: {
              type: "object",
              additionalProperties: schemaRef,
            },
            patternProperties: {
              type: "object",
              additionalProperties: schemaRef,
            },
            $defs: {
              type: "object",
              additionalProperties: schemaRef,
            },
            dependentSchemas: {
              type: "object",
              additionalProperties: schemaRef,
            },
            additionalProperties: schemaRef,
            unevaluatedProperties: schemaRef,
            propertyNames: schemaRef,
            items: schemaRef,
            prefixItems: { type: "array", items: schemaRef },
            contains: schemaRef,
            unevaluatedItems: schemaRef,
            allOf: schemaArray,
            anyOf: schemaArray,
            oneOf: schemaArray,
            not: schemaRef,
            if: schemaRef,
            then: schemaRef,
            else: schemaRef,
            minProperties: { type: "integer", minimum: 0 },
            maxProperties: { type: "integer", minimum: 0 },
            minItems: { type: "integer", minimum: 0 },
            maxItems: { type: "integer", minimum: 0 },
            uniqueItems: { type: "boolean" },
            minContains: { type: "integer", minimum: 0 },
            maxContains: { type: "integer", minimum: 0 },
            minimum: { type: "number" },
            maximum: { type: "number" },
            exclusiveMinimum: { type: "number" },
            exclusiveMaximum: { type: "number" },
            multipleOf: { type: "number", exclusiveMinimum: 0 },
            minLength: { type: "integer", minimum: 0 },
            maxLength: { type: "integer", minimum: 0 },
            pattern: { type: "string" },
            format: { type: "string" },
            readOnly: { type: "boolean" },
            writeOnly: { type: "boolean" },
          },
        },
      ],
    },
  },
  $ref: "#/$defs/schema",
};

const schemaDocumentValidator = new Validator(
  schemaDocumentSchema,
  "2020-12",
  false,
);

function validationMessage(
  errors: ValidationError[],
  fallback: string,
): string {
  if (errors.length === 0) return fallback;
  return errors
    .map(
      (error) =>
        `${error.instanceLocation === "#" ? "/" : error.instanceLocation} ${error.error}`,
    )
    .join("; ");
}

export interface CompiledJsonSchemaValidator {
  assert(value: JsonValue, label?: string, code?: DynamicUIErrorCode): void;
}

/** Validates a JSON Schema 2020-12 document without runtime code generation. */
export function assertValidJsonSchema(
  schema: JsonSchema,
  label = "schema",
  code: DynamicUIErrorCode = "INVALID_COMPONENT_PACK",
): void {
  const result = schemaDocumentValidator.validate(cloneValue(schema));
  if (!result.valid) {
    throw new DynamicUIError(
      code,
      `${label} is not a valid JSON Schema 2020-12 document`,
      { cause: validationMessage(result.errors, "invalid schema") },
    );
  }
}

/** Compiles a trusted schema once for repeated CSP-safe value validation. */
export function compileJsonSchemaValidator(
  schema: JsonSchema,
  label = "schema",
  code: DynamicUIErrorCode = "INVALID_COMPONENT_PACK",
): CompiledJsonSchemaValidator {
  assertValidJsonSchema(schema, label, code);
  let validator: Validator;
  try {
    validator = new Validator(
      cloneValue(schema) as JsonObject,
      "2020-12",
      false,
    );
  } catch (error) {
    throw new DynamicUIError(
      code,
      `Cannot compile ${label} because it is invalid`,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  return {
    assert(value, valueLabel = "value", valueCode = "INVALID_SURFACE"): void {
      const result = validator.validate(value);
      if (!result.valid) {
        throw new DynamicUIError(
          valueCode,
          `${valueLabel} does not match its JSON Schema: ${validationMessage(result.errors, "invalid value")}`,
        );
      }
    },
  };
}

/** Validates a JSON value without eval/new Function, including under strict CSP. */
export function assertMatchesJsonSchema(
  schema: JsonSchema,
  value: JsonValue,
  label = "value",
  code: DynamicUIErrorCode = "INVALID_SURFACE",
): void {
  compileJsonSchemaValidator(schema, `${label} schema`, code).assert(
    value,
    label,
    code,
  );
}
