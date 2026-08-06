import { DynamicUIError, cloneValue } from "@surfaceweave/core";
import type { PreferenceService } from "@surfaceweave/preferences";
import { StorageAdapterError } from "@surfaceweave/storage";

import { preferenceToolDefinitions } from "./definitions.js";
import {
  parseDiscardPreference,
  parseInspectPreferences,
  parseMigratePreference,
  parseSavePreference,
} from "./preference-validation.js";
import type {
  PreferenceDiscardResult,
  PreferenceInspection,
  ToolResult,
  UIToolDefinition,
  UIToolValue,
} from "./types.js";
import { ToolInputError } from "./validation.js";

function knownErrorResult<T>(error: unknown): ToolResult<T> | undefined {
  if (error instanceof DynamicUIError || error instanceof StorageAdapterError) {
    const result: ToolResult<T> = {
      ok: false,
      error: { code: error.code, message: error.message },
    };
    if (error instanceof DynamicUIError && error.details !== undefined) {
      result.error.details = cloneValue(error.details);
    }
    return result;
  }
  if (error instanceof ToolInputError) {
    return {
      ok: false,
      error: { code: error.code, message: error.message },
    };
  }
  return undefined;
}

async function runTool<T>(
  operation: () => Promise<T> | T,
): Promise<ToolResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return (
      knownErrorResult<T>(error) ?? {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The preference tool failed unexpectedly",
        },
      }
    );
  }
}

/** Async tools for explicitly managing persisted preference patches. */
export class PreferenceAgentToolRuntime {
  readonly #preferences: PreferenceService;

  constructor(preferences: PreferenceService) {
    this.#preferences = preferences;
  }

  definitions(): UIToolDefinition[] {
    return cloneValue(preferenceToolDefinitions);
  }

  async execute(
    name: string,
    argumentsValue: unknown,
  ): Promise<ToolResult<UIToolValue>> {
    switch (name) {
      case "ui.inspectPreferences":
        return this.inspectPreferences(argumentsValue);
      case "ui.savePreference":
        return this.savePreference(argumentsValue);
      case "ui.migratePreference":
        return this.migratePreference(argumentsValue);
      case "ui.discardPreference":
        return this.discardPreference(argumentsValue);
      default:
        return {
          ok: false,
          error: {
            code: "UNKNOWN_TOOL",
            message: `UI tool "${name}" is not registered`,
          },
        };
    }
  }

  inspectPreferences(
    argumentsValue: unknown,
  ): ToolResult<PreferenceInspection> {
    try {
      parseInspectPreferences(argumentsValue);
      return {
        ok: true,
        value: {
          preferences: this.#preferences.listPreferences(),
          conflicts: this.#preferences.listConflicts(),
        },
      };
    } catch (error) {
      return (
        knownErrorResult<PreferenceInspection>(error) ?? {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "The preference tool failed unexpectedly",
          },
        }
      );
    }
  }

  async savePreference(argumentsValue: unknown) {
    return runTool(async () => {
      const input = parseSavePreference(argumentsValue);
      return this.#preferences.savePreference(input.preference);
    });
  }

  async migratePreference(argumentsValue: unknown) {
    return runTool(async () => {
      const input = parseMigratePreference(argumentsValue);
      return this.#preferences.migratePreference(
        input.conflictId,
        input.targetStableId,
      );
    });
  }

  async discardPreference(
    argumentsValue: unknown,
  ): Promise<ToolResult<PreferenceDiscardResult>> {
    return runTool(async () => {
      const input = parseDiscardPreference(argumentsValue);
      return {
        preferenceId: await this.#preferences.discardConflict(input.conflictId),
      };
    });
  }
}
