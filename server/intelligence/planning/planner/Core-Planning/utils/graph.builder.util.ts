import type { PlanTask, TaskEdge } from "../types.js";

export interface BuiltGraph {
  readonly edges:     readonly TaskEdge[];
  readonly adjacency: Readonly<Record<string, readonly string[]>>;
  readonly reverseAdj: Readonly<Record<string, readonly string[]>>;
}

function buildOutputIndex(nodes: readonly PlanTask[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const node of nodes) {
    for (const output of node.outputs) {
      index.set(output, node.id);
    }
  }
  return index;
}

function inferEdges(
  nodes:       readonly PlanTask[],
  outputIndex: ReadonlyMap<string, string>,
): readonly TaskEdge[] {
  const edges: TaskEdge[] = [];
  const seen  = new Set<string>();

  for (const node of nodes) {
    for (const input of node.inputs) {
      const producerId = outputIndex.get(input);
      if (producerId === undefined || producerId === node.id) continue;

      const key = `${node.id}::${producerId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push(Object.freeze<TaskEdge>({
        fromTaskId: node.id,
        toTaskId:   producerId,
      }));
    }
  }

  return Object.freeze(edges);
}

function buildAdjacency(
  nodes: readonly PlanTask[],
  edges: readonly TaskEdge[],
): Readonly<Record<string, readonly string[]>> {
  const adj: Record<string, string[]> = {};
  for (const node of nodes) {
    adj[node.id] = [];
  }
  for (const edge of edges) {
    const existing = adj[edge.fromTaskId];
    if (existing !== undefined && !existing.includes(edge.toTaskId)) {
      existing.push(edge.toTaskId);
    }
  }
  const frozen: Record<string, readonly string[]> = {};
  for (const [id, deps] of Object.entries(adj)) {
    frozen[id] = Object.freeze(deps);
  }
  return Object.freeze(frozen);
}

function buildReverseAdjacency(
  nodes:     readonly PlanTask[],
  adjacency: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, readonly string[]>> {
  const rev: Record<string, string[]> = {};
  for (const node of nodes) {
    rev[node.id] = [];
  }
  for (const [nodeId, deps] of Object.entries(adjacency)) {
    for (const dep of deps) {
      const existing = rev[dep];
      if (existing !== undefined && !existing.includes(nodeId)) {
        existing.push(nodeId);
      }
    }
  }
  const frozen: Record<string, readonly string[]> = {};
  for (const [id, rev2] of Object.entries(rev)) {
    frozen[id] = Object.freeze(rev2);
  }
  return Object.freeze(frozen);
}

export function buildGraph(nodes: readonly PlanTask[]): BuiltGraph {
  const outputIndex = buildOutputIndex(nodes);
  const edges       = inferEdges(nodes, outputIndex);
  const adjacency   = buildAdjacency(nodes, edges);
  const reverseAdj  = buildReverseAdjacency(nodes, adjacency);

  return Object.freeze<BuiltGraph>({ edges, adjacency, reverseAdj });
}
