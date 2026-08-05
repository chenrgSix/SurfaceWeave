import type {
  DeveloperHardConstraints,
  PreferenceConflict,
  PreferencePatch,
  SchemaFieldAliases,
  SchemaRef,
  Surface,
} from "@package-first/core";

export interface PreferenceApplicationContext {
  toolId?: string;
  schemaRef?: SchemaRef;
  fieldAliases?: SchemaFieldAliases;
  hardConstraints?: DeveloperHardConstraints;
}

export interface PreferenceApplicationResult {
  surface: Surface;
  appliedPatchIds: string[];
  conflicts: PreferenceConflict[];
}

export interface PreferenceConflictRecord {
  conflict: PreferenceConflict;
  patch: PreferencePatch;
  availableStableIds: string[];
  currentSchemaRef?: SchemaRef;
}
