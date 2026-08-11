import type { JsonObject, JsonValue, ToolDefinition } from "@surfaceweave/core";
import { fromOpenApiOperation } from "@surfaceweave/generator";

import openApiDocument from "../openapi.json";

type OpenApiMethod = "get" | "post" | "put" | "patch" | "delete";

function jsonObject(value: JsonValue | undefined, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function pointerSegment(value: string): string {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

function localReferenceTarget(
  document: JsonObject,
  reference: string,
): JsonValue {
  if (!reference.startsWith("#/")) {
    throw new Error(
      `Only local OpenAPI references are supported: ${reference}`,
    );
  }
  let current: JsonValue = document;
  for (const segment of reference.slice(2).split("/").map(pointerSegment)) {
    const object = jsonObject(current, `OpenAPI reference ${reference}`);
    const next = object[segment];
    if (next === undefined) {
      throw new Error(`OpenAPI reference does not exist: ${reference}`);
    }
    current = next;
  }
  return current;
}

function dereferenceLocalValue(
  value: JsonValue,
  document: JsonObject,
  activeReferences = new Set<string>(),
): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) =>
      dereferenceLocalValue(item, document, activeReferences),
    );
  }
  if (typeof value !== "object" || value === null) return value;

  const reference = typeof value.$ref === "string" ? value.$ref : undefined;
  if (reference !== undefined) {
    if (activeReferences.has(reference)) {
      throw new Error(
        `Cyclic OpenAPI reference is not supported: ${reference}`,
      );
    }
    const nextReferences = new Set(activeReferences).add(reference);
    const resolved = dereferenceLocalValue(
      localReferenceTarget(document, reference),
      document,
      nextReferences,
    );
    const siblings = Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$ref")
        .map(([key, item]) => [
          key,
          dereferenceLocalValue(item, document, activeReferences),
        ]),
    );
    return typeof resolved === "object" &&
      resolved !== null &&
      !Array.isArray(resolved)
      ? { ...resolved, ...siblings }
      : resolved;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      dereferenceLocalValue(item, document, activeReferences),
    ]),
  );
}

function parameterKey(value: JsonValue): string {
  const parameter = jsonObject(value, "OpenAPI parameter");
  return `${String(parameter.in)}:${String(parameter.name)}`;
}

function mergeParameters(
  pathParameters: JsonValue | undefined,
  operationParameters: JsonValue | undefined,
): JsonValue[] {
  const merged = new Map<string, JsonValue>();
  for (const parameter of [
    ...(Array.isArray(pathParameters) ? pathParameters : []),
    ...(Array.isArray(operationParameters) ? operationParameters : []),
  ]) {
    merged.set(parameterKey(parameter), parameter);
  }
  return [...merged.values()];
}

/**
 * Example-only Host preprocessing for the checked-in fixture. The published
 * Generator still accepts one Host-selected, fully dereferenced Operation.
 */
function selectedOperationDocument(
  path: string,
  method: OpenApiMethod,
): JsonObject {
  const source = openApiDocument as JsonObject;
  const dereferenced = jsonObject(
    dereferenceLocalValue(source, source),
    "dereferenced OpenAPI document",
  );
  const paths = jsonObject(dereferenced.paths, "OpenAPI paths");
  const pathItem = jsonObject(paths[path], `OpenAPI path ${path}`);
  const operation = jsonObject(pathItem[method], `OpenAPI ${method} ${path}`);
  const parameters = mergeParameters(pathItem.parameters, operation.parameters);

  return {
    openapi: dereferenced.openapi ?? "3.1.1",
    info: jsonObject(dereferenced.info, "OpenAPI info"),
    paths: {
      [path]: {
        [method]: {
          ...operation,
          ...(parameters.length === 0 ? {} : { parameters }),
        },
      },
    },
  };
}

function definitionFromFixture(
  path: string,
  method: OpenApiMethod,
): ToolDefinition {
  return fromOpenApiOperation({
    document: selectedOperationDocument(path, method),
    path,
    method,
  });
}

export const searchTeaProductsFromOpenApi = definitionFromFixture(
  "/tea-products",
  "get",
);

export const createPurchaseOrderFromOpenApi = definitionFromFixture(
  "/suppliers/{supplierId}/purchase-orders",
  "post",
);

export const openApiAcceptanceEvidence = {
  fixture: "examples/tea-purchase/openapi.json",
  operation: "GET /tea-products",
  operationId: searchTeaProductsFromOpenApi.id,
  generatedFields: Object.keys(
    jsonObject(
      jsonObject(
        searchTeaProductsFromOpenApi.inputSchema as JsonObject,
        "search input schema",
      ).properties,
      "search input properties",
    ),
  ).sort(),
  hostOwnedFieldsExcluded: ["Authorization", "X-Tenant-Id"],
} as const;
