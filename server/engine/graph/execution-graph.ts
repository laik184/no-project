/**
 * execution-graph.ts
 *
 * Immutable-style DAG data structure.
 * Provides add/update/query operations while maintaining consistency.
 */

import { randomUUID }  from "crypto";
import type {
  ExecutionGraph, ExecutionNode, ExecutionEdge,
  NodeStatus, GraphStatus, GraphValidationResult,
} from "./graph-types.ts";

// ── Factory ───────────────────────────────────────────────────────────────────

export function createGraph(
  projectId: number,
  goal:      string,
  runId?:    string,
): ExecutionGraph {
  return {
    id:           runId ?? randomUUID(),
    projectId,
    goal,
    nodes:        new Map(),
    edges:        [],
    status:       "building",
    currentWave:  [],
    completedIds: new Set(),
    failedIds:    new Set(),
    createdAt:    Date.now(),
  };
}

// ── Mutation helpers ──────────────────────────────────────────────────────────

export function addNode(graph: ExecutionGraph, node: ExecutionNode): void {
  if (graph.nodes.has(node.id)) {
    throw new Error(`[exec-graph] Duplicate node id: ${node.id}`);
  }
  graph.nodes.set(node.id, node);
}

export function addEdge(graph: ExecutionGraph, edge: ExecutionEdge): void {
  if (!graph.nodes.has(edge.from)) throw new Error(`[exec-graph] Edge.from not found: ${edge.from}`);
  if (!graph.nodes.has(edge.to))   throw new Error(`[exec-graph] Edge.to not found: ${edge.to}`);
  graph.edges.push(edge);
}

export function setNodeStatus(
  graph:  ExecutionGraph,
  nodeId: string,
  status: NodeStatus,
  result?: unknown,
  error?:  string,
): void {
  const node = graph.nodes.get(nodeId);
  if (!node) throw new Error(`[exec-graph] Node not found: ${nodeId}`);

  node.status = status;
  if (result !== undefined) node.result = result;
  if (error  !== undefined) node.error  = error;

  if (status === "running")  node.startedAt   = Date.now();
  if (status === "success" || status === "failed") {
    node.completedAt = Date.now();
    node.durationMs  = (node.completedAt - (node.startedAt ?? node.completedAt));
  }

  if (status === "success")   graph.completedIds.add(nodeId);
  if (status === "failed")    graph.failedIds.add(nodeId);
  if (status === "skipped")   graph.completedIds.add(nodeId);

  // Remove from currentWave if done
  if (["success", "failed", "skipped", "rolled-back"].includes(status)) {
    graph.currentWave = graph.currentWave.filter(id => id !== nodeId);
  }
}

export function setGraphStatus(graph: ExecutionGraph, status: GraphStatus): void {
  graph.status = status;
  if (status === "running" && !graph.startedAt)  graph.startedAt  = Date.now();
  if (["complete", "failed", "rolled-back"].includes(status)) {
    graph.completedAt = Date.now();
  }
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getNode(graph: ExecutionGraph, nodeId: string): ExecutionNode | undefined {
  return graph.nodes.get(nodeId);
}

export function getAllNodes(graph: ExecutionGraph): ExecutionNode[] {
  return [...graph.nodes.values()];
}

export function getNodesByStatus(graph: ExecutionGraph, status: NodeStatus): ExecutionNode[] {
  return [...graph.nodes.values()].filter(n => n.status === status);
}

export function isGraphComplete(graph: ExecutionGraph): boolean {
  return [...graph.nodes.values()].every(n =>
    ["success", "failed", "skipped", "rolled-back"].includes(n.status),
  );
}

export function hasCriticalFailure(graph: ExecutionGraph): boolean {
  return [...graph.nodes.values()].some(n =>
    n.status === "failed" && n.retryCount >= n.maxRetries,
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateGraph(graph: ExecutionGraph): GraphValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (graph.nodes.size === 0) {
    errors.push("Graph has no nodes");
    return { valid: false, errors, warnings };
  }

  // Check that all dependsOn references exist
  for (const node of graph.nodes.values()) {
    for (const dep of node.dependsOn) {
      if (!graph.nodes.has(dep)) {
        errors.push(`Node "${node.id}" depends on unknown node "${dep}"`);
      }
    }
  }

  // Cycle detection via DFS
  const visited  = new Set<string>();
  const inStack  = new Set<string>();
  const cycleIds: string[] = [];

  function dfs(id: string): boolean {
    visited.add(id);
    inStack.add(id);
    const node = graph.nodes.get(id)!;
    for (const dep of node.dependsOn) {
      if (!visited.has(dep) && dfs(dep)) return true;
      if (inStack.has(dep)) { cycleIds.push(dep); return true; }
    }
    inStack.delete(id);
    return false;
  }

  for (const id of graph.nodes.keys()) {
    if (!visited.has(id) && dfs(id)) {
      errors.push(`Cycle detected involving node(s): ${cycleIds.join(", ")}`);
      break;
    }
  }

  if (graph.nodes.size > 50) warnings.push("Large graph (>50 nodes) — consider splitting");

  return {
    valid:      errors.length === 0,
    errors,
    warnings,
    cycleNodes: cycleIds.length > 0 ? cycleIds : undefined,
  };
}

export function graphSummary(graph: ExecutionGraph): string {
  const t = graph.nodes.size;
  const c = graph.completedIds.size;
  const f = graph.failedIds.size;
  return `[exec-graph] ${graph.id.slice(0, 8)} — ${c}/${t} complete, ${f} failed, status=${graph.status}`;
}
