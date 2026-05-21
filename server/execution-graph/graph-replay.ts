/**
 * server/execution-graph/graph-replay.ts
 * Replays an execution graph in chronological order for debugging.
 * Single responsibility: replay logic. No persistence or side effects.
 */

import type { ExecutionGraph, GraphNode, GraphEdge } from "./types.ts";

export interface ReplayStep {
  step:       number;
  node:       GraphNode;
  causedBy?:  string;   // id of source node (from edge)
  causedWhat: string[]; // ids of nodes this caused (to edges)
}

export function replayGraph(graph: ExecutionGraph): ReplayStep[] {
  const { nodes, edges } = graph;

  // Build adjacency: nodeId → ids of nodes it caused
  const causes = new Map<string, string[]>();
  const parents = new Map<string, string>();

  for (const edge of edges) {
    if (!causes.has(edge.from)) causes.set(edge.from, []);
    causes.get(edge.from)!.push(edge.to);
    parents.set(edge.to, edge.from);
  }

  const sorted = [...nodes].sort((a, b) => a.ts - b.ts);

  return sorted.map((node, i) => ({
    step:       i + 1,
    node,
    causedBy:   parents.get(node.id),
    causedWhat: causes.get(node.id) ?? [],
  }));
}

export function summarizeGraph(graph: ExecutionGraph): string {
  const steps  = replayGraph(graph);
  const counts = new Map<string, number>();

  for (const { node } of steps) {
    counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  }

  const parts = [...counts.entries()].map(([k, v]) => `${k}=${v}`);
  const durationMs = graph.completedAt
    ? graph.completedAt - graph.startedAt
    : Date.now() - graph.startedAt;

  return `Graph(${graph.runId.slice(0, 8)}) ${parts.join(" ")} duration=${durationMs}ms`;
}
