import type { JsonValue } from "@package-first/core";

import type { UIToolDefinition } from "./types.js";

const intentSchema: JsonValue = {
  type: "string",
  enum: ["form", "browse", "single-select", "multi-select", "confirm"],
};

const operationSchema: JsonValue = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "target", "position"],
      properties: {
        type: { const: "moveNode" },
        target: { type: "string" },
        parent: { type: "string" },
        position: {
          oneOf: [{ enum: ["first", "last"] }, { type: "integer", minimum: 0 }],
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "target", "component"],
      properties: {
        type: { const: "replaceComponent" },
        target: { type: "string" },
        component: { type: "string" },
        props: { type: "object" },
        binding: { type: "object" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "target", "props"],
      properties: {
        type: { const: "setProps" },
        target: { type: "string" },
        props: { type: "object" },
        replace: { type: "boolean" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "target", "layout"],
      properties: {
        type: { const: "setLayout" },
        target: { type: "string" },
        layout: { type: "object" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "target", "visible"],
      properties: {
        type: { const: "setVisibility" },
        target: { type: "string" },
        visible: { type: "boolean" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "targets", "group"],
      properties: {
        type: { const: "groupNodes" },
        targets: { type: "array", minItems: 2, items: { type: "string" } },
        group: { type: "object" },
      },
    },
  ],
};

/** JSON Schema definitions passed to a host Agent SDK without importing it. */
export const surfaceToolDefinitions: UIToolDefinition[] = [
  {
    name: "ui.createSurface",
    description:
      "Generate and create a trusted Surface from schema, data, and UI intent.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["surfaceId", "schema", "data", "intent"],
      properties: {
        surfaceId: { type: "string", minLength: 1 },
        schema: { type: "object" },
        data: { type: "object" },
        intent: intentSchema,
        developer: { type: "object" },
        metadata: { type: "object" },
        schemaRef: { type: "object" },
        toolId: { type: "string", minLength: 1 },
        fieldAliases: { type: "object" },
        context: { type: "object" },
        presentation: { type: "object" },
      },
    },
  },
  {
    name: "ui.inspectSurface",
    description:
      "Inspect Surface structure and bindings without returning the full component tree.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["surfaceId"],
      properties: { surfaceId: { type: "string", minLength: 1 } },
    },
  },
  {
    name: "ui.applyOperations",
    description:
      "Atomically apply a batch of semantic UI operations at a base revision.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["surfaceId", "baseRevision", "reason", "operations"],
      properties: {
        surfaceId: { type: "string", minLength: 1 },
        baseRevision: { type: "integer", minimum: 0 },
        reason: { type: "string", minLength: 1 },
        operations: { type: "array", minItems: 1, items: operationSchema },
      },
    },
  },
  {
    name: "ui.replaceSurface",
    description:
      "Replace a Surface while migrating compatible stableId bindings.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["surfaceId", "baseRevision", "surface"],
      properties: {
        surfaceId: { type: "string", minLength: 1 },
        baseRevision: { type: "integer", minimum: 0 },
        surface: {
          type: "object",
          additionalProperties: false,
          required: ["intent", "tree", "data", "context"],
          properties: {
            intent: intentSchema,
            schemaRef: { type: "object" },
            tree: { type: "object" },
            data: { type: "object" },
            context: { type: "object" },
            presentation: { type: "object" },
          },
        },
      },
    },
  },
];

export const preferenceToolDefinitions: UIToolDefinition[] = [
  {
    name: "ui.inspectPreferences",
    description: "List persisted preference patches and unresolved conflicts.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "ui.savePreference",
    description:
      "Persist one confirmed semantic preference patch; never use for temporary overrides.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["confirmed", "preference"],
      properties: {
        confirmed: { const: true },
        preference: {
          type: "object",
          additionalProperties: false,
          required: ["id", "scope", "targetStableId", "operation"],
          properties: {
            id: { type: "string", minLength: 1 },
            scope: { enum: ["global", "intent", "tool"] },
            targetStableId: { type: "string", minLength: 1 },
            operation: { type: "object" },
            schemaRef: { type: "object" },
            intent: intentSchema,
            toolId: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
  {
    name: "ui.migratePreference",
    description:
      "Resolve a preference conflict by explicitly mapping it to a current stableId.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["conflictId", "targetStableId"],
      properties: {
        conflictId: { type: "string", minLength: 1 },
        targetStableId: { type: "string", minLength: 1 },
      },
    },
  },
  {
    name: "ui.discardPreference",
    description: "Discard the persisted preference associated with a conflict.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["conflictId"],
      properties: { conflictId: { type: "string", minLength: 1 } },
    },
  },
];

export const uiToolDefinitions: UIToolDefinition[] = [
  ...surfaceToolDefinitions,
  ...preferenceToolDefinitions,
];
