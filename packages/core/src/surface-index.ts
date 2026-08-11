import { splitDataPath, walkNodes } from "./data.js";
import type { DataBinding, Surface, UINode } from "./types.js";

export interface IndexedBinding {
  nodeId: string;
  binding: DataBinding;
}

interface BindingTrieNode {
  children: Map<string, BindingTrieNode>;
  bindings: IndexedBinding[];
}

export interface SurfaceIndex {
  nodesById: ReadonlyMap<string, UINode>;
  nodesByStableId: ReadonlyMap<string, UINode>;
  bindingsByPath: ReadonlyMap<string, readonly IndexedBinding[]>;
  bindingTrie: BindingTrieNode;
}

function createBindingTrieNode(): BindingTrieNode {
  return { children: new Map(), bindings: [] };
}

function indexBindingPath(
  root: BindingTrieNode,
  path: string,
  binding: IndexedBinding,
): void {
  let current = root;
  for (const segment of splitDataPath(path)) {
    const next = current.children.get(segment) ?? createBindingTrieNode();
    current.children.set(segment, next);
    current = next;
  }
  current.bindings.push(binding);
}

/** Builds one internal read index after a Surface has passed validation. */
export function buildSurfaceIndex(surface: Surface): SurfaceIndex {
  const nodesById = new Map<string, UINode>();
  const nodesByStableId = new Map<string, UINode>();
  const bindingsByPath = new Map<string, IndexedBinding[]>();
  const bindingTrie = createBindingTrieNode();
  walkNodes(surface.tree, (node) => {
    nodesById.set(node.id, node);
    if (node.stableId !== undefined) {
      nodesByStableId.set(node.stableId, node);
    }
    if (node.binding !== undefined) {
      const binding = { nodeId: node.id, binding: node.binding };
      const indexed = bindingsByPath.get(node.binding.path) ?? [];
      indexed.push(binding);
      bindingsByPath.set(node.binding.path, indexed);
      indexBindingPath(bindingTrie, node.binding.path, binding);
    }
  });
  return {
    nodesById,
    nodesByStableId,
    bindingsByPath,
    bindingTrie,
  };
}

function collectBindingNodes(
  node: BindingTrieNode,
  affected: Set<string>,
): void {
  for (const binding of node.bindings) {
    affected.add(binding.nodeId);
  }
  for (const child of node.children.values()) {
    collectBindingNodes(child, affected);
  }
}

/** Returns nodes whose bindings are equal to, contain, or sit below a path. */
export function findAffectedBindingNodeIds(
  index: SurfaceIndex,
  changedPaths: readonly string[],
): string[] {
  const affected = new Set<string>();
  for (const changedPath of changedPaths) {
    let current: BindingTrieNode | undefined = index.bindingTrie;
    for (const segment of splitDataPath(changedPath)) {
      current = current.children.get(segment);
      if (current === undefined) break;
      for (const binding of current.bindings) {
        affected.add(binding.nodeId);
      }
    }
    if (current !== undefined) collectBindingNodes(current, affected);
  }
  return [...affected];
}
