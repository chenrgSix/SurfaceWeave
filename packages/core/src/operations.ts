import {
  assertJsonValue,
  assertSafeDeclaration,
  bindingValueTypeMatches,
  cloneValue,
  readDataPath,
  splitDataPath,
  walkNodes,
} from "./data.js";
import { DynamicUIError } from "./errors.js";
import {
  assertOperationResourceLimits,
  assertSurfaceResourceLimits,
  resolveSurfaceResourceLimits,
} from "./resource-limits.js";
import type {
  ComponentRegistry,
  NodePosition,
  Surface,
  SurfaceResourceLimits,
  UINode,
  UIOperation,
} from "./types.js";

interface NodeLocation {
  node: UINode;
  parent?: UINode;
  index: number;
}

function locateNode(root: UINode, target: string): NodeLocation | undefined {
  if (root.id === target || root.stableId === target) {
    return { node: root, index: 0 };
  }
  for (let index = 0; index < (root.children ?? []).length; index += 1) {
    const child = root.children?.[index];
    if (child === undefined) {
      continue;
    }
    if (child.id === target || child.stableId === target) {
      return { node: child, parent: root, index };
    }
    const nested = locateNode(child, target);
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

function requireLocation(root: UINode, target: string): NodeLocation {
  const location = locateNode(root, target);
  if (location === undefined) {
    throw new DynamicUIError(
      "INVALID_OPERATION",
      `Operation target "${target}" does not exist`,
      { target },
    );
  }
  return location;
}

function insertionIndex(position: NodePosition, length: number): number {
  if (position === "first") {
    return 0;
  }
  if (position === "last") {
    return length;
  }
  if (!Number.isInteger(position) || position < 0 || position > length) {
    throw new DynamicUIError(
      "INVALID_OPERATION",
      `Position ${position} is outside the valid range 0-${length}`,
    );
  }
  return position;
}

function containsNode(root: UINode, candidate: UINode): boolean {
  if (root === candidate) {
    return true;
  }
  return (root.children ?? []).some((child) => containsNode(child, candidate));
}

function moveNode(
  root: UINode,
  operation: Extract<UIOperation, { type: "moveNode" }>,
): void {
  const source = requireLocation(root, operation.target);
  if (source.parent === undefined) {
    throw new DynamicUIError(
      "INVALID_OPERATION",
      "The root node cannot be moved",
    );
  }
  const destination =
    operation.parent === undefined
      ? source.parent
      : requireLocation(root, operation.parent).node;
  if (containsNode(source.node, destination)) {
    throw new DynamicUIError(
      "INVALID_OPERATION",
      "A node cannot be moved into itself or one of its descendants",
    );
  }
  source.parent.children?.splice(source.index, 1);
  destination.children ??= [];
  destination.children.splice(
    insertionIndex(operation.position, destination.children.length),
    0,
    source.node,
  );
}

function groupNodes(
  root: UINode,
  operation: Extract<UIOperation, { type: "groupNodes" }>,
): void {
  if (
    operation.targets.length < 2 ||
    new Set(operation.targets).size !== operation.targets.length
  ) {
    throw new DynamicUIError(
      "INVALID_OPERATION",
      "groupNodes requires at least two unique targets",
    );
  }
  const locations = operation.targets.map((target) =>
    requireLocation(root, target),
  );
  const parent = locations[0]?.parent;
  if (
    parent === undefined ||
    locations.some((location) => location.parent !== parent)
  ) {
    throw new DynamicUIError(
      "INVALID_OPERATION",
      "Grouped nodes must be non-root siblings",
    );
  }
  const ordered = [...locations].sort(
    (left, right) => left.index - right.index,
  );
  const group: UINode = {
    id: operation.group.id,
    component: operation.group.component,
    props: cloneValue(operation.group.props ?? {}),
    children: ordered.map((location) => location.node),
  };
  if (operation.group.stableId !== undefined) {
    group.stableId = operation.group.stableId;
  }
  if (operation.group.layout !== undefined) {
    group.layout = cloneValue(operation.group.layout);
  }
  if (operation.group.visible !== undefined) {
    group.visible = operation.group.visible;
  }
  for (const location of [...ordered].reverse()) {
    parent.children?.splice(location.index, 1);
  }
  parent.children?.splice(ordered[0]?.index ?? 0, 0, group);
}

function applyOperation(root: UINode, operation: UIOperation): void {
  switch (operation.type) {
    case "moveNode":
      moveNode(root, operation);
      return;
    case "replaceComponent": {
      const node = requireLocation(root, operation.target).node;
      node.component = operation.component;
      if (operation.props !== undefined) {
        node.props = cloneValue(operation.props);
      }
      if (operation.binding !== undefined) {
        node.binding = cloneValue(operation.binding);
      }
      return;
    }
    case "setProps": {
      const node = requireLocation(root, operation.target).node;
      node.props = operation.replace
        ? cloneValue(operation.props)
        : { ...node.props, ...cloneValue(operation.props) };
      return;
    }
    case "setLayout":
      requireLocation(root, operation.target).node.layout = cloneValue(
        operation.layout,
      );
      return;
    case "setVisibility":
      requireLocation(root, operation.target).node.visible = operation.visible;
      return;
    case "groupNodes":
      groupNodes(root, operation);
  }
}

export function validateSurface(
  surface: Surface,
  registry: ComponentRegistry,
  resourceLimits: Partial<SurfaceResourceLimits> = {},
): void {
  const limits = resolveSurfaceResourceLimits(resourceLimits);
  assertSurfaceResourceLimits(surface, limits);
  if (surface.id.trim() === "") {
    throw new DynamicUIError("INVALID_SURFACE", "Surface id cannot be empty");
  }
  if (!Number.isInteger(surface.revision) || surface.revision < 0) {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      "Surface revision must be a non-negative integer",
    );
  }
  assertJsonValue(surface.data, "surface.data");
  assertJsonValue(surface.context, "surface.context");
  if (
    surface.presentation?.preferredPack !== undefined &&
    surface.presentation.preferredPack.trim() === ""
  ) {
    throw new DynamicUIError(
      "INVALID_SURFACE",
      "surface.presentation.preferredPack cannot be empty",
    );
  }
  const ids = new Set<string>();
  const stableIds = new Set<string>();
  walkNodes(surface.tree, (node) => {
    if (node.id.trim() === "" || ids.has(node.id)) {
      throw new DynamicUIError(
        "INVALID_SURFACE",
        `Node id "${node.id}" is empty or duplicated`,
      );
    }
    ids.add(node.id);
    assertSafeDeclaration(
      node.props,
      `node[${node.id}].props`,
      "INVALID_SURFACE",
    );
    if (node.layout !== undefined) {
      assertSafeDeclaration(
        node.layout,
        `node[${node.id}].layout`,
        "INVALID_SURFACE",
      );
    }
    if (node.stableId !== undefined) {
      if (node.stableId.trim() === "" || stableIds.has(node.stableId)) {
        throw new DynamicUIError(
          "INVALID_SURFACE",
          `Node stableId "${node.stableId}" is empty or duplicated`,
        );
      }
      stableIds.add(node.stableId);
    }
    if (node.binding !== undefined) {
      try {
        splitDataPath(node.binding.path);
      } catch {
        throw new DynamicUIError(
          "INVALID_SURFACE",
          `Node "${node.id}" has an invalid data binding path`,
        );
      }
      const value = readDataPath(surface.data, node.binding.path);
      if (!bindingValueTypeMatches(node.binding.valueType, value)) {
        throw new DynamicUIError(
          "INVALID_SURFACE",
          `Data at "${node.binding.path}" is incompatible with ${node.binding.valueType} binding`,
        );
      }
    }
    registry.assertNode(node);
  });
}

export function applyOperationsToSurface(
  surface: Surface,
  operations: UIOperation[],
  registry: ComponentRegistry,
  resourceLimits: Partial<SurfaceResourceLimits> = {},
): Surface {
  if (operations.length === 0) {
    throw new DynamicUIError(
      "INVALID_OPERATION",
      "At least one operation is required",
    );
  }
  const limits = resolveSurfaceResourceLimits(resourceLimits);
  assertOperationResourceLimits(operations, limits);
  const candidate = cloneValue(surface);
  for (const operation of operations) {
    applyOperation(candidate.tree, operation);
  }
  validateSurface(candidate, registry, limits);
  return candidate;
}
