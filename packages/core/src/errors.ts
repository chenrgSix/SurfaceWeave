export type DynamicUIErrorCode =
  | "SURFACE_EXISTS"
  | "SURFACE_NOT_FOUND"
  | "REVISION_CONFLICT"
  | "INVALID_SURFACE"
  | "INVALID_OPERATION"
  | "UNKNOWN_COMPONENT"
  | "INVALID_COMPONENT_PACK"
  | "COMPONENT_PACK_NOT_FOUND"
  | "COMPONENT_RESOLUTION_FAILED"
  | "FALLBACK_CYCLE"
  | "INVALID_EXTENSION"
  | "UNKNOWN_ACTION"
  | "INVALID_ACTION_INTENT"
  | "INVALID_PREFERENCE"
  | "PREFERENCE_NOT_FOUND"
  | "PREFERENCE_CONFLICT_NOT_FOUND"
  | "PREFERENCES_NOT_HYDRATED"
  | "HARD_CONSTRAINT_VIOLATION"
  | "INVALID_TOOL_DEFINITION"
  | "TOOL_EXISTS"
  | "TOOL_NOT_FOUND"
  | "TOOL_VERSION_CONFLICT";

/** Stable SDK error suitable for mapping to Agent tool error results. */
export class DynamicUIError extends Error {
  readonly code: DynamicUIErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DynamicUIErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DynamicUIError";
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
