import type {
  DependencyGraph,
  GraphNode,
  GraphEdge,
  DependencyInput,
} from "../types.js";

export type AdjMap = ReadonlyMap<string, readonly string[]>;

export function buildAdjacency(edges: readonly GraphEdge[]): AdjMap {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    if (!map.has(e.from)) map.set(e.from, []);
    map.get(e.from)!.push(e.to);
  }
  return map;
}

export function buildReverseAdjacency(edges: readonly GraphEdge[]): AdjMap {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    if (!map.has(e.to)) map.set(e.to, []);
    map.get(e.to)!.push(e.from);
  }
  return map;
}

export function getNeighbors(adj: AdjMap, nodeId: string): readonly string[] {
  return adj.get(nodeId) ?? Object.freeze([]);
}

export function outDegree(adj: AdjMap, nodeId: string): number {
  return getNeighbors(adj, nodeId).length;
}

export function inDegree(revAdj: AdjMap, nodeId: string): number {
  return getNeighbors(revAdj, nodeId).length;
}

export function nodeById(
  graph: Readonly<DependencyGraph>,
  id:    string,
): GraphNode | null {
  return graph.nodes.find((n) => n.id === id) ?? null;
}

export function edgesFrom(
  graph:  Readonly<DependencyGraph>,
  nodeId: string,
): readonly GraphEdge[] {
  return Object.freeze(graph.edges.filter((e) => e.from === nodeId));
}

export function edgesTo(
  graph:  Readonly<DependencyGraph>,
  nodeId: string,
): readonly GraphEdge[] {
  return Object.freeze(graph.edges.filter((e) => e.to === nodeId));
}

export function isValidInput(input: unknown): input is DependencyInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const obj = input as Record<string, unknown>;
  return typeof obj["projectId"] === "string" && Array.isArray(obj["modules"]);
}

export function deduplicateEdges(
  edges: readonly GraphEdge[],
): readonly GraphEdge[] {
  const seen = new Set<string>();
  const result: GraphEdge[] = [];
  for (const e of edges) {
    const key = `${e.from}→${e.to}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(e);
    }
  }
  return Object.freeze(result);
}

export function graphDensity(nodeCount: number, edgeCount: number): number {
  if (nodeCount < 2) return 0;
  const maxPossible = nodeCount * (nodeCount - 1);
  return Math.round((edgeCount / maxPossible) * 1000) / 1000;
}

export function allNodeIds(graph: Readonly<DependencyGraph>): readonly string[] {
  return Object.freeze(graph.nodes.map((n) => n.id));
}
