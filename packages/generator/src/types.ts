import type {
  DeveloperHardConstraints,
  JsonObject,
  JsonSchema,
  JsonValue,
  SchemaRef,
  Surface,
  SurfaceContext,
  SurfacePresentation,
  UIIntent,
  ToolDefinition,
} from "@surfaceweave/core";

export type JsonSchemaType =
  "object" | "array" | "string" | "number" | "integer" | "boolean";

/** Deliberately small JSON Schema subset supported in Milestone 1. */
export interface SimpleJsonSchema {
  type: JsonSchemaType;
  title?: string;
  description?: string;
  properties?: Record<string, SimpleJsonSchema>;
  required?: string[];
  items?: SimpleJsonSchema;
  enum?: JsonValue[];
  default?: JsonValue;
  format?: string;
  readOnly?: boolean;
  nullable?: boolean;
  oneOf?: SimpleJsonSchema[];
  anyOf?: SimpleJsonSchema[];
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface FieldMetadata {
  label?: string;
  description?: string;
  component?: string;
  props?: Record<string, JsonValue>;
  order?: number;
  hidden?: boolean;
  collapsed?: boolean;
}

export interface DeveloperSoftHints {
  title?: string;
  description?: string;
  rootComponent?: string;
  itemsPath?: string;
  selectionPath?: string;
  itemComponent?: string;
  fields?: Record<string, FieldMetadata>;
}

/** @deprecated Use DeveloperSoftHints through GenerateSurfaceInput.developer. */
export type GeneratorMetadata = DeveloperSoftHints;

export interface DeveloperUIConfiguration {
  hardConstraints?: DeveloperHardConstraints;
  softHints?: DeveloperSoftHints;
}

export interface GenerateSurfaceInput {
  surfaceId: string;
  schema: SimpleJsonSchema;
  data: JsonObject;
  intent: UIIntent;
  developer?: DeveloperUIConfiguration;
  /** @deprecated Use developer.softHints. */
  metadata?: GeneratorMetadata;
  schemaRef?: SchemaRef;
  context?: SurfaceContext;
  presentation?: SurfacePresentation;
}

export type GeneratedSurface = Omit<Surface, "revision">;

export interface GenerateToolSurfaceInput {
  definition: ToolDefinition;
  surfaceId: string;
  initialValues?: JsonObject;
  context?: SurfaceContext;
  presentation?: SurfacePresentation;
}

export interface AgentToolDefinitionInput {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  version?: string;
}

export interface OpenApiToolInput {
  document: JsonObject;
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete";
}

export interface GenerateResultSurfaceInput {
  definition: ToolDefinition;
  surfaceId: string;
  invocationId: string;
  correlationId: string;
  result?: JsonValue;
  status: "success" | "partial" | "error";
  errors?: Array<{ code: string; message: string }>;
  retryable?: boolean;
}
