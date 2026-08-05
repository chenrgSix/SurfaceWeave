import type {
  DataBinding,
  PreferenceConflict,
  PreferencePatch,
  JsonValue,
  SchemaFieldAliases,
  SchemaRef,
  Surface,
  SurfaceContext,
  UINode,
  UIOperation,
  UIIntent,
} from "@package-first/core";
import type {
  DeveloperUIConfiguration,
  GeneratorMetadata,
  SimpleJsonSchema,
} from "@package-first/generator";

export type UIToolName =
  | "ui.createSurface"
  | "ui.inspectSurface"
  | "ui.applyOperations"
  | "ui.replaceSurface"
  | "ui.inspectPreferences"
  | "ui.savePreference"
  | "ui.migratePreference"
  | "ui.discardPreference";

/** Portable function-tool definition; adapters can map it to any Agent SDK. */
export interface UIToolDefinition {
  name: UIToolName;
  description: string;
  inputSchema: Record<string, JsonValue>;
}

export interface ToolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type ToolResult<T> =
  { ok: true; value: T } | { ok: false; error: ToolError };

export interface CreateSurfaceToolInput {
  surfaceId: string;
  schema: SimpleJsonSchema;
  data: Record<string, unknown>;
  intent: UIIntent;
  developer?: DeveloperUIConfiguration;
  metadata?: GeneratorMetadata;
  schemaRef?: SchemaRef;
  toolId?: string;
  fieldAliases?: SchemaFieldAliases;
  context?: SurfaceContext;
}

export interface InspectSurfaceToolInput {
  surfaceId: string;
}

export interface ApplyOperationsToolInput {
  surfaceId: string;
  baseRevision: number;
  reason: string;
  operations: UIOperation[];
}

export interface ReplaceSurfaceToolInput {
  surfaceId: string;
  baseRevision: number;
  surface: {
    intent: UIIntent;
    schemaRef?: SchemaRef;
    tree: UINode;
    data: Record<string, unknown>;
    context: SurfaceContext;
  };
}

export interface InspectedNode {
  id: string;
  stableId?: string;
  component: string;
  binding?: DataBinding;
  visible: boolean;
  childCount: number;
}

export interface SurfaceInspection {
  id: string;
  revision: number;
  intent: UIIntent;
  schemaRef?: SchemaRef;
  nodes: InspectedNode[];
  dataPaths: string[];
}

export type InspectPreferencesToolInput = Record<string, never>;

export interface SavePreferenceToolInput {
  confirmed: true;
  preference: PreferencePatch;
}

export interface MigratePreferenceToolInput {
  conflictId: string;
  targetStableId: string;
}

export interface DiscardPreferenceToolInput {
  conflictId: string;
}

export interface PreferenceInspection {
  preferences: PreferencePatch[];
  conflicts: PreferenceConflict[];
}

export interface PreferenceDiscardResult {
  preferenceId: string;
}

export type UIToolValue =
  | Surface
  | SurfaceInspection
  | PreferenceInspection
  | PreferencePatch
  | PreferenceDiscardResult;
