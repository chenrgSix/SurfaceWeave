import type {
  DeveloperHardConstraints,
  PreferenceConflict,
  PreferencePatch,
  SchemaFieldAliases,
  SchemaRef,
  Surface,
} from "@surfaceweave/core";

export interface PreferenceApplicationContext {
  toolId?: string;
  schemaRef?: SchemaRef;
  fieldAliases?: SchemaFieldAliases;
  hardConstraints?: DeveloperHardConstraints;
}

/** Result of composing durable patches over one deterministic default Surface. */
export interface PreferenceApplicationResult {
  surface: Surface;
  appliedPatchIds: string[];
  conflicts: PreferenceConflict[];
}

/** Internal resolution state retained until a conflict is migrated or discarded. */
export interface PreferenceConflictRecord {
  conflict: PreferenceConflict;
  patch: PreferencePatch;
  availableStableIds: string[];
  currentSchemaRef?: SchemaRef;
}
