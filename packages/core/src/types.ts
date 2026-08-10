/** JSON-compatible primitive value. */
export type JsonPrimitive = string | number | boolean | null;

/** JSON-compatible value accepted at SDK trust boundaries. */
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

/** JSON-compatible object used by every wire-level record. */
export interface JsonObject {
  [key: string]: JsonValue;
}

/** JSON Schema document. The protocol uses the 2020-12 dialect. */
export type JsonSchema = boolean | JsonObject;

/** Serializable, host-registered description of one executable business tool. */
export interface ToolDefinition {
  id: string;
  version: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  uiHints?: ToolUIHints;
}

export interface ToolAnnotations {
  sideEffect?: boolean;
  confirmation?: "never" | "required";
  retry?: "never" | "safe";
  sensitiveInputPaths?: string[];
}

export interface ToolSemanticFieldHint {
  purpose?: string;
  group?: string;
  component?: string;
  importance?: "low" | "normal" | "high";
}

export interface ToolUIHints {
  hardConstraints?: DeveloperHardConstraints;
  softHints?: {
    title?: string;
    description?: string;
    rootComponent?: string;
    layout?: JsonObject;
    groups?: Record<string, JsonObject>;
    fields?: Record<string, JsonObject>;
  };
  semanticHints?: Record<string, ToolSemanticFieldHint>;
}

export interface ToolRegistry {
  register(definition: ToolDefinition): void;
  unregister(toolId: string): boolean;
  get(toolId: string): ToolDefinition | undefined;
  require(toolId: string, version?: string): ToolDefinition;
  list(): ToolDefinition[];
}

/** Supported interaction modes for default UI generation. */
export type UIIntent =
  "form" | "browse" | "single-select" | "multi-select" | "confirm";

export type BindingValueType =
  "string" | "number" | "boolean" | "object" | "array" | "unknown";

/** Connects a trusted UI node to data stored separately on its Surface. */
export interface DataBinding {
  path: string;
  valueType: BindingValueType;
  semantic?: string;
  required?: boolean;
}

export interface SchemaRef {
  id: string;
  version?: string;
}

export interface SurfaceContext {
  source?: string;
  [key: string]: JsonValue | undefined;
}

/** Namespaced, versioned vendor data validated by the selected component pack. */
export interface ComponentExtension {
  version: string;
  value: JsonValue;
}

export interface SurfacePresentation {
  /** A renderer hint only; changing it must not rewrite the semantic tree. */
  preferredPack?: string;
}

/** Portable layout features understood by LayoutSpec 1.0 renderers. */
export type SemanticLayoutFeature =
  "direction" | "columns" | "gap" | "align" | "justify" | "span";

export type SemanticLayoutDirection = "row" | "column";
export type SemanticLayoutAlignment = "start" | "center" | "end" | "stretch";
export type SemanticLayoutJustification =
  "start" | "center" | "end" | "between";

/** Mode-independent values used by a semantic layout and its mode overrides. */
export interface SemanticLayoutValues {
  direction?: SemanticLayoutDirection;
  columns?: number;
  gap?: number;
  align?: SemanticLayoutAlignment;
  justify?: SemanticLayoutJustification;
  span?: number;
}

/**
 * Framework-neutral LayoutSpec 1.0 declaration.
 *
 * UINode.layout remains a JSON record for Wire Protocol 1.0 compatibility;
 * generators and trusted authors should emit this portable subset.
 */
export interface SemanticLayout extends SemanticLayoutValues {
  modes?: {
    compact?: SemanticLayoutValues;
    workspace?: SemanticLayoutValues;
  };
}

export type SemanticLayoutDiagnosticCode =
  | "UNKNOWN_LAYOUT_PROPERTY"
  | "INVALID_LAYOUT_VALUE"
  | "UNSUPPORTED_LAYOUT_FEATURE"
  | "COMPACT_LAYOUT_FALLBACK";

export interface SemanticLayoutDiagnostic {
  code: SemanticLayoutDiagnosticCode;
  path: string;
  message: string;
}

export interface SemanticLayoutResolution {
  layout: SemanticLayoutValues;
  diagnostics: SemanticLayoutDiagnostic[];
}

/** Declarative node. The component name must exist in ComponentRegistry. */
export interface UINode {
  id: string;
  stableId?: string;
  component: string;
  props: Record<string, JsonValue>;
  binding?: DataBinding;
  children?: UINode[];
  layout?: Record<string, JsonValue>;
  visible?: boolean;
  extensions?: Record<string, ComponentExtension>;
}

/** A logical UI shared by every renderer connected to the same store. */
export interface Surface {
  id: string;
  revision: number;
  intent: UIIntent;
  schemaRef?: SchemaRef;
  tree: UINode;
  data: JsonObject;
  context: SurfaceContext;
  presentation?: SurfacePresentation;
}

/** Host-configurable guardrails for untrusted Surface and Operation payloads. */
export interface SurfaceResourceLimits {
  maxNodes: number;
  maxTreeDepth: number;
  maxOperationsPerBatch: number;
  maxJsonDepth: number;
  maxJsonValues: number;
  maxStringLength: number;
}

export type NodePosition = "first" | "last" | number;

export interface MoveNodeOperation {
  type: "moveNode";
  target: string;
  parent?: string;
  position: NodePosition;
}

export interface ReplaceComponentOperation {
  type: "replaceComponent";
  target: string;
  component: string;
  props?: Record<string, JsonValue>;
  binding?: DataBinding;
}

export interface SetPropsOperation {
  type: "setProps";
  target: string;
  props: Record<string, JsonValue>;
  replace?: boolean;
}

export interface SetLayoutOperation {
  type: "setLayout";
  target: string;
  layout: Record<string, JsonValue>;
}

export interface SetVisibilityOperation {
  type: "setVisibility";
  target: string;
  visible: boolean;
}

export interface GroupNodeDefinition {
  id: string;
  stableId?: string;
  component: string;
  props?: Record<string, JsonValue>;
  layout?: Record<string, JsonValue>;
  visible?: boolean;
}

export interface GroupNodesOperation {
  type: "groupNodes";
  targets: string[];
  group: GroupNodeDefinition;
}

/** Semantic mutations accepted from trusted host code or validated Agent tools. */
export type UIOperation =
  | MoveNodeOperation
  | ReplaceComponentOperation
  | SetPropsOperation
  | SetLayoutOperation
  | SetVisibilityOperation
  | GroupNodesOperation;

/** Single-target semantic mutations that can be stored relative to a default UI. */
export type PreferenceOperation = Exclude<UIOperation, GroupNodesOperation>;

export type PreferenceScope = "global" | "intent" | "tool";

/** Long-lived UI preference; it never stores session form data or a full Surface. */
export interface PreferencePatch {
  id: string;
  scope: PreferenceScope;
  targetStableId: string;
  operation: PreferenceOperation;
  schemaRef?: SchemaRef;
  intent?: UIIntent;
  toolId?: string;
}

export interface PreferenceDocument {
  version: 1;
  patches: PreferencePatch[];
}

/** Developer-declared old stableId to current stableId candidates. */
export type SchemaFieldAliases = Record<string, string | string[]>;

export interface DataMigrationConflict {
  code: "TARGET_MISSING" | "ALIAS_AMBIGUOUS" | "TYPE_INCOMPATIBLE";
  previousStableId: string;
  suggestedStableIds: string[];
  message: string;
}

export interface SurfaceDataMigrationResult {
  surface: Surface;
  conflicts: DataMigrationConflict[];
}

export type UIConstraintAspect =
  "component" | "props" | "layout" | "visibility" | "position";

export interface FieldHardConstraint {
  component?: string;
  visible?: boolean;
  locked?: UIConstraintAspect[];
}

/** Non-negotiable developer rules enforced after every personalization layer. */
export interface DeveloperHardConstraints {
  rootComponent?: string;
  allowedComponents?: string[];
  fields?: Record<string, FieldHardConstraint>;
}

export type PreferenceConflictCode =
  | "TARGET_MISSING"
  | "SCHEMA_VERSION_MISMATCH"
  | "ALIAS_AMBIGUOUS"
  | "HARD_CONSTRAINT"
  | "INVALID_OPERATION";

/** Explicit resolution request produced when a durable patch cannot be applied. */
export interface PreferenceConflict {
  id: string;
  patchId: string;
  surfaceId: string;
  code: PreferenceConflictCode;
  targetStableId: string;
  message: string;
  schemaRef?: SchemaRef;
  suggestedStableIds?: string[];
}

export interface SurfaceCreatedEvent {
  type: "surface.created";
  sequence: number;
  surfaceId: string;
  revision: number;
  surface: Surface;
}

export interface SurfaceOperationsAppliedEvent {
  type: "surface.operationsApplied";
  sequence: number;
  surfaceId: string;
  revision: number;
  operations: UIOperation[];
}

export interface SurfaceReplacedEvent {
  type: "surface.replaced";
  sequence: number;
  surfaceId: string;
  revision: number;
  previousRevision: number;
  surface: Surface;
}

export interface DataChange {
  path: string;
  value: JsonValue;
}

export interface SurfaceDataChangedEvent {
  type: "surface.dataChanged";
  sequence: number;
  surfaceId: string;
  revision: number;
  changes: DataChange[];
}

export interface PreferenceConflictedEvent {
  type: "preference.conflicted";
  sequence: number;
  surfaceId: string;
  conflict: PreferenceConflict;
}

export interface PreferenceSavedEvent {
  type: "preference.saved";
  sequence: number;
  preference: PreferencePatch;
}

export interface PreferenceMigratedEvent {
  type: "preference.migrated";
  sequence: number;
  preference: PreferencePatch;
  previousTargetStableId: string;
}

export interface PreferenceDiscardedEvent {
  type: "preference.discarded";
  sequence: number;
  preferenceId: string;
}

export type PreferenceEvent =
  | PreferenceConflictedEvent
  | PreferenceSavedEvent
  | PreferenceMigratedEvent
  | PreferenceDiscardedEvent;

/** Deterministic events emitted by SurfaceStore in committed mutation order. */
export type SurfaceEvent =
  | SurfaceCreatedEvent
  | SurfaceOperationsAppliedEvent
  | SurfaceReplacedEvent
  | SurfaceDataChangedEvent;

export type ToolInvocationStatus =
  | "idle"
  | "editing"
  | "validating"
  | "awaiting-confirmation"
  | "submitting"
  | "success"
  | "error"
  | "cancelled";

export type ToolActionName =
  | "tool.validate"
  | "tool.request-confirmation"
  | "tool.submit"
  | "tool.cancel"
  | "tool.retry"
  | "tool.edit"
  | "result.continue";

export interface ToolInvocation {
  id: string;
  toolId: string;
  toolVersion: string;
  sourceSurfaceId: string;
  resultSurfaceId?: string;
  correlationId: string;
  status: ToolInvocationStatus;
  revision: number;
  attempt: number;
  lastIdempotencyKey?: string;
  error?: ActionError;
}

export interface ToolSubmissionRequest {
  invocationId: string;
  toolId: string;
  toolVersion: string;
  validatedArguments: JsonObject;
  correlationId: string;
  idempotencyKey: string;
  sourceSurfaceId: string;
  sequence: number;
}

export interface ToolRuntimeEvent {
  type:
    | "tool.surfaceCreated"
    | "tool.inputChanged"
    | "tool.validationFailed"
    | "tool.confirmationRequested"
    | "tool.invocationRequested"
    | "tool.invocationStarted"
    | "tool.invocationSucceeded"
    | "tool.invocationFailed"
    | "tool.invocationCancelled"
    | "tool.retryRequested"
    | "result.surfaceCreated"
    | "ui.dataMigrationConflict";
  sequence: number;
  invocationId: string;
  correlationId: string;
  toolId: string;
  toolVersion: string;
  status: ToolInvocationStatus;
  surfaceId?: string;
  resultSurfaceId?: string;
  redactedArguments?: JsonObject;
  error?: ActionError;
  details?: JsonObject;
}

export type UIEvent = SurfaceEvent | PreferenceEvent | ToolRuntimeEvent;

/** Serializable request emitted by a component for execution by its host. */
export interface ActionIntent {
  id: string;
  surfaceId: string;
  nodeId: string;
  action: string;
  input: JsonValue;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface ActionError {
  code: string;
  message: string;
}

export interface ActionResult {
  intentId: string;
  status: "success" | "error" | "cancelled";
  output?: JsonValue;
  error?: ActionError;
}

/** Implemented by the embedding application; SDK components never call a network directly. */
export interface ActionExecutor {
  execute(intent: ActionIntent): Promise<ActionResult>;
}

/** Optional host-side shape; the Runtime emits requests but never invokes it. */
export interface ToolHostExecutor {
  execute(request: ToolSubmissionRequest): Promise<JsonValue>;
}

export interface ToolInvocationStore {
  create(
    invocation: Omit<ToolInvocation, "revision" | "attempt"> & {
      revision?: number;
      attempt?: number;
    },
  ): ToolInvocation;
  get(invocationId: string): ToolInvocation | undefined;
  require(invocationId: string): ToolInvocation;
  list(): ToolInvocation[];
  transition(
    invocationId: string,
    status: ToolInvocationStatus,
    patch?: Partial<
      Pick<
        ToolInvocation,
        "resultSurfaceId" | "lastIdempotencyKey" | "error" | "attempt"
      >
    >,
  ): ToolInvocation;
}

export interface ComponentActionDefinition {
  name: string;
  sideEffect?: boolean;
  requiresConfirmation?: boolean;
  inputSchema?: JsonSchema;
}

export interface ComponentBindingDefinition {
  valueTypes: BindingValueType[];
  semantics?: string[];
}

export interface ComponentExtensionSchema {
  version: string;
  schema: JsonSchema;
}

/** Concise model-facing guidance. It is advisory and never overrides schemas. */
export interface AgentGuidance {
  summary: string;
  usage?: string[];
  avoid?: string[];
}

/** Serializable semantic component declaration shared across renderers. */
export interface ComponentManifest {
  semanticType: string;
  description?: string;
  propsSchema: JsonSchema;
  actionSchema?: JsonSchema;
  binding?: ComponentBindingDefinition;
  actions?: Array<string | ComponentActionDefinition>;
  capabilities?: string[];
  /** LayoutSpec features this semantic component can apply portably. */
  layoutCapabilities?: SemanticLayoutFeature[];
  fallback?: string;
  extensions?: Record<string, ComponentExtensionSchema>;
}

/** Serializable pack metadata. Runtime component bindings live outside Core. */
export interface ComponentPackManifest {
  protocolVersion: "1.0";
  id: string;
  version: string;
  rendererKind: string;
  priority?: number;
  capabilities?: string[];
  components: ComponentManifest[];
  agentGuidance?: AgentGuidance;
}

export type ComponentPackDiagnosticCode =
  | "PREFERRED_PACK_UNAVAILABLE"
  | "PACK_VERSION_INCOMPATIBLE"
  | "PACK_CAPABILITY_MISMATCH"
  | "COMPONENT_CAPABILITY_MISMATCH"
  | "FALLBACK_APPLIED";

export interface ComponentPackDiagnostic {
  code: ComponentPackDiagnosticCode;
  message: string;
  packId?: string;
  semanticType?: string;
}

export interface ComponentResolutionRequest {
  semanticType: string;
  rendererKind: string;
  preferredPack?: string;
  capabilities?: string[];
  packPriorities?: Record<string, number>;
  /** Optional exact versions accepted by this host for specific pack ids. */
  supportedPackVersions?: Record<string, string[]>;
  /** Runtime registries use this to exclude manifests without local bindings. */
  availablePackIds?: string[];
}

/** Deterministic data-only result consumed by a framework-specific registry. */
export interface ComponentResolution {
  requestedSemanticType: string;
  resolvedSemanticType: string;
  rendererKind: string;
  packId: string;
  packVersion: string;
  fallbackChain: string[];
  diagnostics: ComponentPackDiagnostic[];
}

/** Data-only description of a trusted component available to generators and tools. */
export interface ComponentDefinition {
  type: string;
  description?: string;
  propsSchema?: JsonSchema;
  actionSchema?: JsonSchema;
  binding?: ComponentBindingDefinition;
  actions?: Array<string | ComponentActionDefinition>;
  capabilities?: string[];
  layoutCapabilities?: SemanticLayoutFeature[];
  fallback?: string;
  extensions?: Record<string, ComponentExtensionSchema>;
}

export interface ComponentRegistry {
  register(definition: ComponentDefinition): void;
  registerPack(manifest: ComponentPackManifest): void;
  has(type: string): boolean;
  get(type: string): ComponentDefinition | undefined;
  require(type: string): ComponentDefinition;
  list(): ComponentDefinition[];
  listPacks(): ComponentPackManifest[];
  assertNode(node: UINode): void;
  assertAction(component: string, action: string): void;
}

export type SurfaceListener = (event: SurfaceEvent, surface: Surface) => void;

export type PreferenceListener = (event: PreferenceEvent) => void;

export interface SurfaceStore {
  createSurface(
    surface: Omit<Surface, "revision"> & { revision?: number },
  ): Surface;
  getSurface(surfaceId: string): Surface | undefined;
  requireSurface(surfaceId: string): Surface;
  subscribe(surfaceId: string, listener: SurfaceListener): () => void;
  applyOperations(
    surfaceId: string,
    baseRevision: number,
    operations: UIOperation[],
  ): Surface;
  updateData(
    surfaceId: string,
    baseRevision: number,
    changes: DataChange[],
  ): Surface;
  replaceSurface(
    surfaceId: string,
    baseRevision: number,
    replacement: Omit<Surface, "id" | "revision">,
  ): Surface;
}

/** Presentation density selected by a host for one mounted Surface view. */
export type SurfaceViewMode = "compact" | "workspace";

/**
 * Serializable reference controlled by a host integration.
 *
 * Security-sensitive renderer configuration is deliberately excluded. It is
 * fixed when the host creates its renderer driver.
 */
export interface SurfaceViewReference {
  surfaceId: string;
  mode: SurfaceViewMode;
}

/** Lifecycle handle returned for one mounted Surface view. */
export interface SurfaceViewHandle {
  update(reference: SurfaceViewReference): void;
  unmount(): void;
}

/** Framework-neutral mounting contract implemented by renderer packages. */
export interface SurfaceRendererDriver<TTarget> {
  mount(target: TTarget, reference: SurfaceViewReference): SurfaceViewHandle;
}
