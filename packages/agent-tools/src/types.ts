import type {
  DataBinding,
  PreferenceConflict,
  PreferencePatch,
  JsonValue,
  JsonObject,
  SchemaFieldAliases,
  SchemaRef,
  Surface,
  SurfaceComponentCatalog,
  CreateSurfaceClientCapabilitiesOptions,
  SurfaceContext,
  SurfacePresentation,
  UINode,
  UIOperation,
  UIIntent,
  ToolDefinition,
  ToolInvocation,
} from "@surfaceweave/core";
import type {
  DeveloperUIConfiguration,
  GeneratorMetadata,
  SimpleJsonSchema,
} from "@surfaceweave/generator";

export type UIToolName =
  | "ui.createSurface"
  | "ui.inspectSurface"
  | "ui.inspectComponentPacks"
  | "ui.applyOperations"
  | "ui.replaceSurface"
  | "ui.inspectTools"
  | "ui.inspectTool"
  | "ui.createToolSurface"
  | "ui.inspectInvocation"
  | "ui.proposeToolSubmission"
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
  data: JsonObject;
  intent: UIIntent;
  developer?: DeveloperUIConfiguration;
  metadata?: GeneratorMetadata;
  schemaRef?: SchemaRef;
  toolId?: string;
  fieldAliases?: SchemaFieldAliases;
  context?: SurfaceContext;
  presentation?: SurfacePresentation;
}

export interface InspectSurfaceToolInput {
  surfaceId: string;
}

export interface InspectComponentPacksToolInput {
  rendererKind?: string;
  capabilities?: string[];
}

/** Trusted host policy used to generate Agent-readable client capabilities. */
export interface AgentUIToolRuntimeOptions {
  clientCapabilities?: CreateSurfaceClientCapabilitiesOptions;
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
    data: JsonObject;
    context: SurfaceContext;
    presentation?: SurfacePresentation;
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

/** Serializable discovery result; it never contains runtime bindings. */
export type ComponentCatalogInspection = SurfaceComponentCatalog;

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

export interface ToolCatalogInspection {
  tools: Array<
    Pick<
      ToolDefinition,
      "id" | "version" | "title" | "description" | "annotations"
    >
  >;
}

export interface ToolProposalResult {
  invocation: ToolInvocation;
  outcome: "confirmation-required" | "invocation-requested" | "state-changed";
  confirmationSurfaceId?: string;
}

export interface ToolSurfaceCreation {
  surface: Surface;
  invocation: ToolInvocation;
}

export type UIToolValue =
  | Surface
  | SurfaceInspection
  | ComponentCatalogInspection
  | PreferenceInspection
  | PreferencePatch
  | PreferenceDiscardResult
  | ToolCatalogInspection
  | ToolDefinition
  | ToolInvocation
  | ToolProposalResult
  | ToolSurfaceCreation;
