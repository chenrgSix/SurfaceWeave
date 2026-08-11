import {
  DynamicUIError,
  assertValidJsonSchema,
  cloneValue,
} from "@surfaceweave/core";
import type {
  JsonObject,
  JsonSchema,
  JsonValue,
  ToolDefinition,
} from "@surfaceweave/core";

import type {
  AgentToolDefinitionInput,
  OpenApiParameterLocation,
  OpenApiParameterSource,
  OpenApiToolInput,
  SimpleJsonSchema,
} from "./types.js";

const supportedTypes = new Set([
  "object",
  "array",
  "string",
  "number",
  "integer",
  "boolean",
]);

function objectValue(value: JsonValue | undefined, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      `${label} must be an object`,
    );
  }
  return value;
}

function optionalString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function inferType(schema: JsonObject): SimpleJsonSchema["type"] {
  const declared = schema.type;
  const candidates = Array.isArray(declared) ? declared : [declared];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && supportedTypes.has(candidate)) {
      return candidate as SimpleJsonSchema["type"];
    }
  }
  if (schema.properties !== undefined) return "object";
  if (schema.items !== undefined) return "array";
  if (Array.isArray(schema.enum)) {
    const first = schema.enum.find((item) => item !== null);
    if (typeof first === "number") return "number";
    if (typeof first === "boolean") return "boolean";
  }
  return "string";
}

function numberKeyword(
  schema: JsonObject,
  key: "minimum" | "maximum" | "multipleOf" | "minLength" | "maxLength",
): number | undefined {
  const value = schema[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** Normalizes the supported JSON Schema 2020-12 subset for deterministic UI generation. */
export function normalizeToolSchema(schema: JsonSchema): SimpleJsonSchema {
  assertValidJsonSchema(schema, "Tool schema");
  if (schema === true) return { type: "string" };
  if (schema === false) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      "A false Tool schema accepts no input",
    );
  }
  const type = inferType(schema);
  const result: SimpleJsonSchema = { type };
  for (const key of ["title", "description", "format", "pattern"] as const) {
    const value = optionalString(schema[key]);
    if (value !== undefined) result[key] = value;
  }
  for (const key of ["readOnly", "nullable"] as const) {
    if (typeof schema[key] === "boolean") result[key] = schema[key];
  }
  const declaredTypes = Array.isArray(schema.type) ? schema.type : [];
  if (declaredTypes.includes("null")) result.nullable = true;
  for (const key of [
    "minimum",
    "maximum",
    "multipleOf",
    "minLength",
    "maxLength",
  ] as const) {
    const value = numberKeyword(schema, key);
    if (value !== undefined) result[key] = value;
  }
  if (Array.isArray(schema.required)) {
    result.required = schema.required.filter(
      (item): item is string => typeof item === "string",
    );
  }
  if (Array.isArray(schema.enum)) result.enum = cloneValue(schema.enum);
  if (schema.default !== undefined) result.default = cloneValue(schema.default);
  if (type === "object" && schema.properties !== undefined) {
    const properties = objectValue(schema.properties, "schema.properties");
    result.properties = Object.fromEntries(
      Object.entries(properties)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, property]) => [
          name,
          normalizeToolSchema(property as JsonSchema),
        ]),
    );
  }
  if (type === "array" && schema.items !== undefined) {
    result.items = normalizeToolSchema(schema.items as JsonSchema);
  }
  for (const keyword of ["oneOf", "anyOf"] as const) {
    const branches = schema[keyword];
    if (Array.isArray(branches)) {
      result[keyword] = branches.map((branch) =>
        normalizeToolSchema(branch as JsonSchema),
      );
      const enumValues = result[keyword]
        .flatMap((branch) => branch.enum ?? [])
        .filter(
          (value, index, all) =>
            all.findIndex(
              (candidate) =>
                JSON.stringify(candidate) === JSON.stringify(value),
            ) === index,
        );
      if (enumValues.length > 0) result.enum = enumValues;
    }
  }
  return result;
}

export function fromJsonSchemaTool(definition: ToolDefinition): ToolDefinition {
  assertValidJsonSchema(
    definition.inputSchema,
    `Input schema for ${definition.id}`,
  );
  if (definition.outputSchema !== undefined) {
    assertValidJsonSchema(
      definition.outputSchema,
      `Output schema for ${definition.id}`,
    );
  }
  return cloneValue(definition);
}

export function fromAgentToolDefinition(
  input: AgentToolDefinitionInput,
): ToolDefinition {
  return fromJsonSchemaTool({
    id: input.name,
    version: input.version ?? "1.0.0",
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    inputSchema: input.inputSchema,
    ...(input.outputSchema === undefined
      ? {}
      : { outputSchema: input.outputSchema }),
  });
}

function inlineSchema(value: JsonValue | undefined, label: string): JsonSchema {
  if (value === undefined) return true;
  const object = objectValue(value, label);
  if ("$ref" in object) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      `${label} must be dereferenced before adapting the Operation`,
    );
  }
  return object;
}

const openApiParameterLocations = new Set<OpenApiParameterLocation>([
  "path",
  "query",
  "header",
  "cookie",
]);

const protectedHeaderNames = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
]);

function openApiParameterLocation(
  value: JsonValue | undefined,
  name: string,
): OpenApiParameterLocation {
  if (
    typeof value !== "string" ||
    !openApiParameterLocations.has(value as OpenApiParameterLocation)
  ) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      `OpenAPI parameter "${name}" has an invalid location`,
    );
  }
  return value as OpenApiParameterLocation;
}

function openApiParameterSource(
  input: OpenApiToolInput,
  location: OpenApiParameterLocation,
  name: string,
): OpenApiParameterSource {
  const key = `${location}:${name}` as const;
  const configured = input.parameterSources?.[key];
  if (
    configured !== undefined &&
    configured !== "user" &&
    configured !== "host"
  ) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      `OpenAPI parameter source for "${key}" must be user or host`,
    );
  }
  const source =
    configured ??
    (location === "header" || location === "cookie" ? "host" : "user");
  if (
    source === "user" &&
    (location === "cookie" || protectedHeaderNames.has(name.toLowerCase()))
  ) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      `Security-sensitive OpenAPI parameter "${key}" cannot be user-controlled`,
    );
  }
  return source;
}

/** Converts one dereferenced OpenAPI 3.1 Operation without retaining HTTP execution data. */
export function fromOpenApiOperation(input: OpenApiToolInput): ToolDefinition {
  const paths = objectValue(input.document.paths, "document.paths");
  const pathItem = objectValue(paths[input.path], `paths.${input.path}`);
  const operation = objectValue(
    pathItem[input.method],
    `${input.method} operation`,
  );
  const operationId = optionalString(operation.operationId);
  if (operationId === undefined) {
    throw new DynamicUIError(
      "INVALID_TOOL_DEFINITION",
      "OpenAPI operationId is required",
    );
  }
  const properties: JsonObject = {};
  const required: string[] = [];
  const parameters = operation.parameters;
  if (Array.isArray(parameters)) {
    for (const item of parameters) {
      const parameter = objectValue(item, "operation.parameters[]");
      const name = optionalString(parameter.name);
      if (name === undefined) {
        throw new DynamicUIError(
          "INVALID_TOOL_DEFINITION",
          "OpenAPI parameter name is required",
        );
      }
      const location = openApiParameterLocation(parameter.in, name);
      if (openApiParameterSource(input, location, name) === "host") continue;
      properties[name] = inlineSchema(
        parameter.schema,
        `parameter ${name}.schema`,
      );
      if (parameter.required === true) required.push(name);
    }
  }
  if (operation.requestBody !== undefined) {
    const body = objectValue(operation.requestBody, "operation.requestBody");
    const content = objectValue(body.content, "operation.requestBody.content");
    const media = objectValue(
      content["application/json"],
      "application/json request body",
    );
    const bodySchema = inlineSchema(media.schema, "request body schema");
    if (
      bodySchema !== true &&
      bodySchema !== false &&
      bodySchema.type === "object"
    ) {
      const bodyProperties = objectValue(
        bodySchema.properties,
        "request body properties",
      );
      for (const [name, schema] of Object.entries(bodyProperties)) {
        if (properties[name] !== undefined) {
          throw new DynamicUIError(
            "INVALID_TOOL_DEFINITION",
            `Duplicate OpenAPI argument "${name}"`,
          );
        }
        properties[name] = schema;
      }
      if (Array.isArray(bodySchema.required)) {
        required.push(
          ...bodySchema.required.filter(
            (item): item is string => typeof item === "string",
          ),
        );
      }
    } else {
      properties.body = bodySchema;
      if (body.required === true) required.push("body");
    }
  }
  let outputSchema: JsonSchema | undefined;
  if (operation.responses !== undefined) {
    const responses = objectValue(operation.responses, "operation.responses");
    const successKey = Object.keys(responses)
      .sort()
      .find((key) => /^2\d\d$/.test(key));
    if (successKey !== undefined) {
      const response = objectValue(
        responses[successKey],
        `response ${successKey}`,
      );
      if (response.content !== undefined) {
        const content = objectValue(
          response.content,
          `response ${successKey}.content`,
        );
        const media = content["application/json"];
        if (media !== undefined) {
          outputSchema = inlineSchema(
            objectValue(media, "response media").schema,
            "response schema",
          );
        }
      }
    }
  }
  const title = optionalString(operation.summary);
  const description = optionalString(operation.description);
  return fromJsonSchemaTool({
    id: operationId,
    version:
      optionalString(
        objectValue(input.document.info, "document.info").version,
      ) ?? "1.0.0",
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    inputSchema: {
      type: "object",
      properties,
      ...(required.length === 0 ? {} : { required }),
    },
    ...(outputSchema === undefined ? {} : { outputSchema }),
  });
}
