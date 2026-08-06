import {
  DynamicUIError,
  applyOperationsToSurface,
  cloneValue,
  walkNodes,
} from "@surfaceweave/core";
import type {
  ComponentRegistry,
  DeveloperHardConstraints,
  FieldHardConstraint,
  PreferenceConflict,
  PreferenceEvent,
  PreferenceListener,
  PreferenceOperation,
  PreferencePatch,
  SchemaRef,
  Surface,
  UINode,
  UIOperation,
  UIConstraintAspect,
} from "@surfaceweave/core";

import type { PreferenceRepository } from "./repository.js";
import type {
  PreferenceApplicationContext,
  PreferenceApplicationResult,
  PreferenceConflictRecord,
} from "./types.js";

function scopeRank(patch: PreferencePatch): number {
  return patch.scope === "global" ? 0 : patch.scope === "intent" ? 1 : 2;
}

function scopeMatches(
  patch: PreferencePatch,
  surface: Surface,
  context: PreferenceApplicationContext,
): boolean {
  if (patch.scope === "global") {
    return true;
  }
  if (patch.scope === "intent") {
    return patch.intent === surface.intent;
  }
  return context.toolId !== undefined && patch.toolId === context.toolId;
}

function stableNodes(surface: Surface): Map<string, UINode> {
  const nodes = new Map<string, UINode>();
  walkNodes(surface.tree, (node) => {
    if (node.stableId !== undefined) {
      nodes.set(node.stableId, node);
    }
  });
  return nodes;
}

function nodePlacement(
  surface: Surface,
  stableId: string,
): { parent: string | undefined; index: number } | undefined {
  let placement: { parent: string | undefined; index: number } | undefined;
  const visit = (node: UINode, parent: UINode | undefined): void => {
    if (node.stableId === stableId) {
      placement = {
        parent: parent?.stableId ?? parent?.id,
        index: parent?.children?.indexOf(node) ?? 0,
      };
      return;
    }
    for (const child of node.children ?? []) {
      visit(child, node);
    }
  };
  visit(surface.tree, undefined);
  return placement;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => valuesEqual(item, right[index]))
    );
  }
  if (
    typeof left === "object" &&
    left !== null &&
    !Array.isArray(left) &&
    typeof right === "object" &&
    right !== null &&
    !Array.isArray(right)
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = Object.keys(leftRecord).sort();
    return (
      keys.length === Object.keys(rightRecord).length &&
      keys.every((key) => valuesEqual(leftRecord[key], rightRecord[key]))
    );
  }
  return false;
}

function operationAspect(
  operation: UIOperation,
): UIConstraintAspect | undefined {
  switch (operation.type) {
    case "moveNode":
      return "position";
    case "replaceComponent":
      return "component";
    case "setProps":
      return "props";
    case "setLayout":
      return "layout";
    case "setVisibility":
      return "visibility";
    case "groupNodes":
      return undefined;
  }
}

function findNode(surface: Surface, target: string): UINode | undefined {
  let found: UINode | undefined;
  walkNodes(surface.tree, (node) => {
    if (node.id === target || node.stableId === target) {
      found = node;
    }
  });
  return found;
}

function constraintFor(
  surface: Surface,
  target: string,
  constraints: DeveloperHardConstraints | undefined,
): { node?: UINode; constraint?: FieldHardConstraint } {
  const node = findNode(surface, target);
  const stableId = node?.stableId;
  return {
    ...(node === undefined ? {} : { node }),
    ...(stableId === undefined || constraints?.fields?.[stableId] === undefined
      ? {}
      : { constraint: constraints.fields[stableId] }),
  };
}

function hardConstraintMessage(
  surface: Surface,
  operation: UIOperation,
  constraints: DeveloperHardConstraints | undefined,
): string | undefined {
  if (operation.type === "groupNodes") {
    if (
      constraints?.allowedComponents !== undefined &&
      !constraints.allowedComponents.includes(operation.group.component)
    ) {
      return `Component "${operation.group.component}" is outside the developer allow-list`;
    }
    for (const target of operation.targets) {
      const { constraint } = constraintFor(surface, target, constraints);
      if (constraint?.locked?.includes("position") === true) {
        return `Field "${target}" has a locked position`;
      }
    }
    return undefined;
  }
  const { constraint } = constraintFor(surface, operation.target, constraints);
  const aspect = operationAspect(operation);
  if (aspect !== undefined && constraint?.locked?.includes(aspect) === true) {
    return `Field "${operation.target}" locks ${aspect}`;
  }
  if (
    operation.type === "replaceComponent" &&
    constraints?.allowedComponents !== undefined &&
    !constraints.allowedComponents.includes(operation.component)
  ) {
    return `Component "${operation.component}" is outside the developer allow-list`;
  }
  if (
    operation.type === "replaceComponent" &&
    constraint?.component !== undefined &&
    operation.component !== constraint.component
  ) {
    return `Field "${operation.target}" requires component "${constraint.component}"`;
  }
  if (
    operation.type === "setVisibility" &&
    constraint?.visible !== undefined &&
    operation.visible !== constraint.visible
  ) {
    return `Field "${operation.target}" has fixed visibility`;
  }
  return undefined;
}

function rewriteOperationTarget(
  operation: PreferenceOperation,
  target: string,
): PreferenceOperation {
  return { ...cloneValue(operation), target };
}

function schemaRefsDiffer(
  stored: SchemaRef | undefined,
  current: SchemaRef | undefined,
): boolean {
  if (stored === undefined || current === undefined) {
    return false;
  }
  return stored.id !== current.id || stored.version !== current.version;
}

export function assertOperationsAllowedByHardConstraints(
  surface: Surface,
  operations: UIOperation[],
  constraints: DeveloperHardConstraints | undefined,
  registry: ComponentRegistry,
): void {
  for (const operation of operations) {
    const violation = hardConstraintMessage(surface, operation, constraints);
    if (violation !== undefined) {
      throw new DynamicUIError("HARD_CONSTRAINT_VIOLATION", violation);
    }
  }
  applyOperationsToSurface(surface, operations, registry);
}

/** Validates a complete temporary replacement against developer-owned rules. */
export function assertSurfaceSatisfiesHardConstraints(
  surface: Surface,
  constraints: DeveloperHardConstraints | undefined,
  referenceSurface?: Surface,
): void {
  if (constraints === undefined) {
    return;
  }
  if (
    constraints.rootComponent !== undefined &&
    surface.tree.component !== constraints.rootComponent
  ) {
    throw new DynamicUIError(
      "HARD_CONSTRAINT_VIOLATION",
      `Surface root requires component "${constraints.rootComponent}"`,
    );
  }
  if (constraints.allowedComponents !== undefined) {
    walkNodes(surface.tree, (node) => {
      if (!constraints.allowedComponents?.includes(node.component)) {
        throw new DynamicUIError(
          "HARD_CONSTRAINT_VIOLATION",
          `Component "${node.component}" is outside the developer allow-list`,
        );
      }
    });
  }
  const nodes = stableNodes(surface);
  const referenceNodes =
    referenceSurface === undefined ? undefined : stableNodes(referenceSurface);
  for (const [stableId, constraint] of Object.entries(
    constraints.fields ?? {},
  )) {
    const node = nodes.get(stableId);
    const referenceNode = referenceNodes?.get(stableId);
    if (
      constraint.visible === true &&
      (node === undefined || node.visible === false)
    ) {
      throw new DynamicUIError(
        "HARD_CONSTRAINT_VIOLATION",
        `Field "${stableId}" must remain visible`,
      );
    }
    if (
      constraint.visible === false &&
      node !== undefined &&
      node.visible !== false
    ) {
      throw new DynamicUIError(
        "HARD_CONSTRAINT_VIOLATION",
        `Field "${stableId}" must remain hidden`,
      );
    }
    if (
      constraint.component !== undefined &&
      node !== undefined &&
      node.component !== constraint.component
    ) {
      throw new DynamicUIError(
        "HARD_CONSTRAINT_VIOLATION",
        `Field "${stableId}" requires component "${constraint.component}"`,
      );
    }
    for (const aspect of constraint.locked ?? []) {
      const missingLockedNode =
        referenceNode !== undefined && node === undefined;
      const changed =
        missingLockedNode ||
        (referenceNode !== undefined &&
          node !== undefined &&
          ((aspect === "component" &&
            referenceNode.component !== node.component) ||
            (aspect === "props" &&
              !valuesEqual(referenceNode.props, node.props)) ||
            (aspect === "layout" &&
              !valuesEqual(referenceNode.layout, node.layout)) ||
            (aspect === "visibility" &&
              (referenceNode.visible !== false) !== (node.visible !== false)) ||
            (aspect === "position" &&
              !valuesEqual(
                nodePlacement(referenceSurface as Surface, stableId),
                nodePlacement(surface, stableId),
              ))));
      if (changed) {
        throw new DynamicUIError(
          "HARD_CONSTRAINT_VIOLATION",
          `Field "${stableId}" locks ${aspect}`,
        );
      }
    }
  }
}

/** Applies persisted preferences without mutating the long-lived document. */
export class PreferenceService {
  readonly #registry: ComponentRegistry;
  readonly #repository: PreferenceRepository;
  readonly #listeners = new Set<PreferenceListener>();
  readonly #conflicts = new Map<string, PreferenceConflictRecord>();
  readonly #contexts = new Map<string, PreferenceApplicationContext>();
  #sequence = 0;

  constructor(repository: PreferenceRepository, registry: ComponentRegistry) {
    this.#repository = repository;
    this.#registry = registry;
  }

  async hydrate(): Promise<void> {
    await this.#repository.hydrate();
  }

  subscribe(listener: PreferenceListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  listPreferences(): PreferencePatch[] {
    return this.#repository.list();
  }

  listConflicts(): PreferenceConflict[] {
    return [...this.#conflicts.values()]
      .map((record) => cloneValue(record.conflict))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  contextFor(surfaceId: string): PreferenceApplicationContext | undefined {
    const context = this.#contexts.get(surfaceId);
    return context === undefined ? undefined : cloneValue(context);
  }

  async savePreference(patch: PreferencePatch): Promise<PreferencePatch> {
    const saved = await this.#repository.upsert(patch);
    this.#emit({
      type: "preference.saved",
      sequence: this.#nextSequence(),
      preference: cloneValue(saved),
    });
    return saved;
  }

  applyPreferences(
    defaultSurface: Surface,
    context: PreferenceApplicationContext = {},
  ): PreferenceApplicationResult {
    this.#contexts.set(defaultSurface.id, cloneValue(context));
    for (const [id, record] of this.#conflicts) {
      if (record.conflict.surfaceId === defaultSurface.id) {
        this.#conflicts.delete(id);
      }
    }
    let candidate = cloneValue(defaultSurface);
    const conflicts: PreferenceConflict[] = [];
    const appliedPatchIds: string[] = [];
    const patches = this.#repository
      .list()
      .filter((patch) => scopeMatches(patch, defaultSurface, context))
      .sort(
        (left, right) =>
          scopeRank(left) - scopeRank(right) || left.id.localeCompare(right.id),
      );

    for (const patch of patches) {
      const nodes = stableNodes(candidate);
      const availableStableIds = [...nodes.keys()].sort();
      const currentSchemaRef = context.schemaRef ?? candidate.schemaRef;
      const exactTarget = nodes.has(patch.targetStableId);
      if (
        patch.schemaRef !== undefined &&
        currentSchemaRef !== undefined &&
        patch.schemaRef.id !== currentSchemaRef.id
      ) {
        conflicts.push(
          this.#recordConflict(
            candidate,
            patch,
            "SCHEMA_VERSION_MISMATCH",
            `Preference schema "${patch.schemaRef.id}" does not match "${currentSchemaRef.id}"`,
            availableStableIds,
            currentSchemaRef,
          ),
        );
        continue;
      }
      if (!exactTarget) {
        const alias = context.fieldAliases?.[patch.targetStableId];
        const suggestions = (
          Array.isArray(alias) ? alias : alias === undefined ? [] : [alias]
        )
          .filter((target, index, values) => values.indexOf(target) === index)
          .filter((target) => nodes.has(target))
          .sort();
        const versionChanged = schemaRefsDiffer(
          patch.schemaRef,
          currentSchemaRef,
        );
        const code =
          suggestions.length > 1
            ? "ALIAS_AMBIGUOUS"
            : versionChanged && suggestions.length === 1
              ? "SCHEMA_VERSION_MISMATCH"
              : "TARGET_MISSING";
        conflicts.push(
          this.#recordConflict(
            candidate,
            patch,
            code,
            suggestions.length === 0
              ? `Stable field "${patch.targetStableId}" no longer exists`
              : `Preference target requires explicit migration`,
            availableStableIds,
            currentSchemaRef,
            suggestions,
          ),
        );
        continue;
      }

      const operation = rewriteOperationTarget(
        patch.operation,
        patch.targetStableId,
      );
      const violation = hardConstraintMessage(
        candidate,
        operation,
        context.hardConstraints,
      );
      if (violation !== undefined) {
        conflicts.push(
          this.#recordConflict(
            candidate,
            patch,
            "HARD_CONSTRAINT",
            violation,
            availableStableIds,
            currentSchemaRef,
          ),
        );
        continue;
      }
      try {
        candidate = applyOperationsToSurface(
          candidate,
          [operation],
          this.#registry,
        );
        appliedPatchIds.push(patch.id);
      } catch (error) {
        conflicts.push(
          this.#recordConflict(
            candidate,
            patch,
            "INVALID_OPERATION",
            error instanceof Error
              ? error.message
              : "Preference operation is invalid",
            availableStableIds,
            currentSchemaRef,
          ),
        );
      }
    }
    assertSurfaceSatisfiesHardConstraints(candidate, context.hardConstraints);
    return {
      surface: candidate,
      appliedPatchIds,
      conflicts,
    };
  }

  assertTemporaryOperationsAllowed(
    surface: Surface,
    operations: UIOperation[],
    constraints: DeveloperHardConstraints | undefined = this.#contexts.get(
      surface.id,
    )?.hardConstraints,
  ): void {
    assertOperationsAllowedByHardConstraints(
      surface,
      operations,
      constraints,
      this.#registry,
    );
  }

  async migratePreference(
    conflictId: string,
    targetStableId: string,
  ): Promise<PreferencePatch> {
    const record = this.#conflicts.get(conflictId);
    if (record === undefined) {
      throw new DynamicUIError(
        "PREFERENCE_CONFLICT_NOT_FOUND",
        `Preference conflict "${conflictId}" does not exist`,
      );
    }
    if (!record.availableStableIds.includes(targetStableId)) {
      throw new DynamicUIError(
        "INVALID_PREFERENCE",
        `Migration target "${targetStableId}" is not present on the current Surface`,
      );
    }
    const preference: PreferencePatch = {
      ...cloneValue(record.patch),
      targetStableId,
      operation: rewriteOperationTarget(record.patch.operation, targetStableId),
    };
    if (record.currentSchemaRef !== undefined) {
      preference.schemaRef = cloneValue(record.currentSchemaRef);
    }
    const saved = await this.#repository.upsert(preference);
    const previousTargetStableId = record.patch.targetStableId;
    for (const [id, item] of this.#conflicts) {
      if (item.patch.id === saved.id) {
        this.#conflicts.delete(id);
      }
    }
    this.#emit({
      type: "preference.migrated",
      sequence: this.#nextSequence(),
      preference: cloneValue(saved),
      previousTargetStableId,
    });
    return saved;
  }

  async discardConflict(conflictId: string): Promise<string> {
    const record = this.#conflicts.get(conflictId);
    if (record === undefined) {
      throw new DynamicUIError(
        "PREFERENCE_CONFLICT_NOT_FOUND",
        `Preference conflict "${conflictId}" does not exist`,
      );
    }
    await this.#repository.remove(record.patch.id);
    for (const [id, item] of this.#conflicts) {
      if (item.patch.id === record.patch.id) {
        this.#conflicts.delete(id);
      }
    }
    this.#emit({
      type: "preference.discarded",
      sequence: this.#nextSequence(),
      preferenceId: record.patch.id,
    });
    return record.patch.id;
  }

  #recordConflict(
    surface: Surface,
    patch: PreferencePatch,
    code: PreferenceConflict["code"],
    message: string,
    availableStableIds: string[],
    currentSchemaRef?: SchemaRef,
    suggestedStableIds: string[] = [],
  ): PreferenceConflict {
    const conflict: PreferenceConflict = {
      id: `${surface.id}:${patch.id}:${code}`,
      patchId: patch.id,
      surfaceId: surface.id,
      code,
      targetStableId: patch.targetStableId,
      message,
    };
    if (currentSchemaRef !== undefined) {
      conflict.schemaRef = cloneValue(currentSchemaRef);
    }
    if (suggestedStableIds.length > 0) {
      conflict.suggestedStableIds = cloneValue(suggestedStableIds);
    }
    const record: PreferenceConflictRecord = {
      conflict,
      patch: cloneValue(patch),
      availableStableIds: cloneValue(availableStableIds),
    };
    if (currentSchemaRef !== undefined) {
      record.currentSchemaRef = cloneValue(currentSchemaRef);
    }
    this.#conflicts.set(conflict.id, record);
    this.#emit({
      type: "preference.conflicted",
      sequence: this.#nextSequence(),
      surfaceId: surface.id,
      conflict: cloneValue(conflict),
    });
    return cloneValue(conflict);
  }

  #nextSequence(): number {
    this.#sequence += 1;
    return this.#sequence;
  }

  #emit(event: PreferenceEvent): void {
    for (const listener of this.#listeners) {
      listener(cloneValue(event));
    }
  }
}
