import {
  bindingsAreCompatible,
  cloneValue,
  collectBindings,
  readDataPath,
  writeDataPath,
} from "./data.js";
import type {
  DataMigrationConflict,
  SchemaFieldAliases,
  Surface,
  SurfaceDataMigrationResult,
} from "./types.js";

/** Migrates compatible bound values by stableId and explicit developer aliases. */
export function migrateSurfaceData(
  previous: Surface,
  replacement: Surface,
  aliases: SchemaFieldAliases = {},
): SurfaceDataMigrationResult {
  const next = cloneValue(replacement);
  const previousBindings = collectBindings(previous.tree);
  const nextBindings = collectBindings(next.tree);
  const conflicts: DataMigrationConflict[] = [];
  for (const [previousStableId, previousBinding] of previousBindings) {
    const direct = nextBindings.get(previousStableId);
    const alias = aliases[previousStableId];
    const candidates =
      direct === undefined
        ? alias === undefined
          ? []
          : Array.isArray(alias)
            ? alias
            : [alias]
        : [previousStableId];
    if (candidates.length === 0) continue;
    if (candidates.length > 1) {
      conflicts.push({
        code: "ALIAS_AMBIGUOUS",
        previousStableId,
        suggestedStableIds: [...candidates].sort(),
        message: `Field alias for "${previousStableId}" resolves to multiple targets`,
      });
      continue;
    }
    const targetStableId = candidates[0] as string;
    const nextBinding = nextBindings.get(targetStableId);
    if (nextBinding === undefined) {
      conflicts.push({
        code: "TARGET_MISSING",
        previousStableId,
        suggestedStableIds: [targetStableId],
        message: `Migration target "${targetStableId}" does not exist`,
      });
      continue;
    }
    if (!bindingsAreCompatible(previousBinding, nextBinding)) {
      conflicts.push({
        code: "TYPE_INCOMPATIBLE",
        previousStableId,
        suggestedStableIds: [targetStableId],
        message: `Field "${previousStableId}" is incompatible with "${targetStableId}"`,
      });
      continue;
    }
    const value = readDataPath(previous.data, previousBinding.path);
    if (value !== undefined) writeDataPath(next.data, nextBinding.path, value);
  }
  return { surface: next, conflicts };
}
