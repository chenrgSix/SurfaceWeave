export type DynamicUIErrorCode =
  | "SURFACE_EXISTS"
  | "SURFACE_NOT_FOUND"
  | "REVISION_CONFLICT"
  | "INVALID_SURFACE"
  | "INVALID_OPERATION"
  | "UNKNOWN_COMPONENT"
  | "UNKNOWN_ACTION"
  | "INVALID_ACTION_INTENT";

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
