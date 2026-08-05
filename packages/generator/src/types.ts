import type {
  JsonValue,
  SchemaRef,
  Surface,
  SurfaceContext,
  UIIntent,
} from "@package-first/core";

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

export interface GeneratorMetadata {
  title?: string;
  description?: string;
  rootComponent?: string;
  itemsPath?: string;
  selectionPath?: string;
  itemComponent?: string;
  fields?: Record<string, FieldMetadata>;
}

export interface GenerateSurfaceInput {
  surfaceId: string;
  schema: SimpleJsonSchema;
  data: Record<string, unknown>;
  intent: UIIntent;
  metadata?: GeneratorMetadata;
  schemaRef?: SchemaRef;
  context?: SurfaceContext;
}

export type GeneratedSurface = Omit<Surface, "revision">;
