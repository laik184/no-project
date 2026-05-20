import type { ArchNode, ArchEdge, ArchitectureGraph } from "../types.js";

export interface NodeIndex {
  readonly byId:   ReadonlyMap<string, ArchNode>;
  readonly byPath: ReadonlyMap<string, ArchNode>;
}

export function buildNodeIndex(nodes: readonly ArchNode[]): NodeIndex {
  const byId   = new Map<string, ArchNode>();
  const byPath = new Map<string, ArchNode>();
  for (const n of nodes) {
    byId.set(n.id, n);
    byPath.set(n.path, n);
  }
  return Object.freeze({ byId, byPath });
}

export function getNode(
  index: NodeIndex,
  id:    string,
): ArchNode | null {
  return index.byId.get(id) ?? null;
}

export function edgesFrom(
  edges:  readonly ArchEdge[],
  nodeId: string,
): readonly ArchEdge[] {
  return Object.freeze(edges.filter((e) => e.from === nodeId));
}

export function edgesTo(
  edges:  readonly ArchEdge[],
  nodeId: string,
): readonly ArchEdge[] {
  return Object.freeze(edges.filter((e) => e.to === nodeId));
}

export function isValidGraph(g: unknown): g is ArchitectureGraph {
  if (!g || typeof g !== "object" || Array.isArray(g)) return false;
  const obj = g as Record<string, unknown>;
  return (
    typeof obj["projectId"] === "string" &&
    Array.isArray(obj["nodes"]) &&
    Array.isArray(obj["edges"])
  );
}

export function resolveEdgeNodes(
  edge:  Readonly<ArchEdge>,
  index: NodeIndex,
): { from: ArchNode; to: ArchNode } | null {
  const from = index.byId.get(edge.from) ?? null;
  const to   = index.byId.get(edge.to)   ?? null;
  if (!from || !to) return null;
  return Object.freeze({ from, to });
}

export function domainEdges(
  edges:    readonly ArchEdge[],
  index:    NodeIndex,
  fromDomain: string,
  toDomain:   string,
): readonly ArchEdge[] {
  return Object.freeze(
    edges.filter((e) => {
      const pair = resolveEdgeNodes(e, index);
      if (!pair) return false;
      return pair.from.domain === fromDomain && pair.to.domain === toDomain;
    }),
  );
}

export function nodesByLayer(
  nodes: readonly ArchNode[],
  layer: number,
): readonly ArchNode[] {
  return Object.freeze(nodes.filter((n) => n.layer === layer));
}

export function nodesByDomain(
  nodes:  readonly ArchNode[],
  domain: string,
): readonly ArchNode[] {
  return Object.freeze(nodes.filter((n) => n.domain === domain));
}

export function detectCycles(
  nodes: readonly ArchNode[],
  edges: readonly ArchEdge[],
): readonly string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const neighbors = adj.get(e.from);
    if (neighbors) neighbors.push(e.to);
  }

  const visited  = new Set<string>();
  const inStack  = new Set<string>();
  const cycles:   string[][] = [];

  function dfs(nodeId: string, path: string[]): void {
    if (inStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), nodeId]);
      }
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);
    for (const neighbor of adj.get(nodeId) ?? []) {
      dfs(neighbor, path);
    }
    path.pop();
    inStack.delete(nodeId);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) dfs(n.id, []);
  }

  return cycles.map((c) => [...c]) as string[][];
}
