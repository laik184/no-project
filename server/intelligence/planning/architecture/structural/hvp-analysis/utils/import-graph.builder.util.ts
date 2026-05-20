import type {
  FileNode,
  ImportEdge,
  LayerDefinition,
  IntermediateImportGraph,
} from "../types.js";
import { getAllowedTargetLevels } from "./layer-map.builder.util.js";

function resolveTargetLayer(
  targetPath:  string,
  files:       readonly FileNode[],
): number {
  const found = files.find((f) => f.path === targetPath);
  return found ? found.layer : 0;
}

function resolveTargetRole(
  targetPath: string,
  files:      readonly FileNode[],
): import("../types.js").FileRole {
  const found = files.find((f) => f.path === targetPath);
  return found ? found.role : "unknown";
}

function isImportAllowed(
  fromLayer:   number,
  toLayer:     number,
  definitions: readonly LayerDefinition[],
): boolean {
  if (fromLayer === 0 || toLayer === 0) return false;
  if (fromLayer === toLayer) return true;
  const allowed = getAllowedTargetLevels(fromLayer, definitions);
  return (allowed as readonly number[]).includes(toLayer);
}

export function buildImportGraph(
  files:       readonly FileNode[],
  definitions: readonly LayerDefinition[],
  nowMs:       number = Date.now(),
): IntermediateImportGraph {
  if (!Array.isArray(files) || files.length === 0) {
    return Object.freeze({
      edges:     Object.freeze<ImportEdge[]>([]),
      nodeCount: 0,
      edgeCount: 0,
      builtAt:   nowMs,
    });
  }

  const edges: ImportEdge[] = [];

  for (const file of files) {
    for (const imp of file.imports) {
      const toLayer = resolveTargetLayer(imp, files);
      const toRole  = resolveTargetRole(imp, files);
      const allowed = isImportAllowed(file.layer, toLayer, definitions);

      edges.push(Object.freeze({
        from:      file.path,
        to:        imp,
        fromLayer: file.layer,
        toLayer,
        fromRole:  file.role,
        toRole,
        allowed,
      }));
    }
  }

  return Object.freeze({
    edges:     Object.freeze(edges),
    nodeCount: files.length,
    edgeCount: edges.length,
    builtAt:   nowMs,
  });
}

export function detectCycles(edges: readonly ImportEdge[]): readonly string[][] {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from)!.add(e.to);
  }

  const cycles: string[][] = [];
  const visited  = new Set<string>();
  const inStack  = new Set<string>();

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      } else if (inStack.has(neighbor)) {
        const idx = path.indexOf(neighbor);
        if (idx !== -1) cycles.push(path.slice(idx));
      }
    }
    inStack.delete(node);
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) dfs(node, [node]);
  }
  return cycles.map((c) => [...c]) as string[][];
}

export function filterViolatingEdges(
  edges: readonly ImportEdge[],
): readonly ImportEdge[] {
  return Object.freeze(edges.filter((e) => !e.allowed));
}

export function edgesByFromFile(
  edges: readonly ImportEdge[],
  path:  string,
): readonly ImportEdge[] {
  return Object.freeze(edges.filter((e) => e.from === path));
}
