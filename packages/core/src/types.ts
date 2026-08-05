/** JSON-compatible primitive value. */
export type JsonPrimitive = string | number | boolean | null;

/** JSON-compatible value accepted at SDK trust boundaries. */
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

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
}

/** A logical UI shared by every renderer connected to the same store. */
export interface Surface {
  id: string;
  revision: number;
  intent: UIIntent;
  schemaRef?: SchemaRef;
  tree: UINode;
  data: Record<string, unknown>;
  context: SurfaceContext;
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

export type SchemaFieldAliases = Record<string, string | string[]>;

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
  value: unknown;
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

export type UIEvent = SurfaceEvent | PreferenceEvent;

/** Serializable request emitted by a component for execution by its host. */
export interface ActionIntent {
  id: string;
  surfaceId: string;
  nodeId: string;
  action: string;
  input: JsonValue;
  idempotencyKey?: string;
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

export interface ComponentActionDefinition {
  name: string;
  sideEffect?: boolean;
  requiresConfirmation?: boolean;
}

export interface ComponentBindingDefinition {
  valueTypes: BindingValueType[];
  semantics?: string[];
}

/** Data-only description of a trusted component available to generators and tools. */
export interface ComponentDefinition {
  type: string;
  description?: string;
  propsSchema?: Record<string, JsonValue>;
  binding?: ComponentBindingDefinition;
  actions?: Array<string | ComponentActionDefinition>;
  capabilities?: string[];
  fallback?: string;
}

export interface ComponentRegistry {
  register(definition: ComponentDefinition): void;
  has(type: string): boolean;
  get(type: string): ComponentDefinition | undefined;
  require(type: string): ComponentDefinition;
  list(): ComponentDefinition[];
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
