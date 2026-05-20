/**
 * graph-state.ts
 *
 * Lightweight checkpoint + restore system for execution graphs.
 * Allows pausing and replaying partial execution from a safe point.
 */

import type { ExecutionGraph, ExecutionNode, GraphStatus } from "./graph-types.ts";

export interface GraphCheckpoint {
  runId:        string;
  projectId:    number;
  goal:         string;
  ts:           number;
  checkpointAt: string;        // nodeId of last success
  nodeSnapshots: NodeSnapshot[];
  completedIds: string[];
  failedIds:    string[];
  graphStatus:  GraphStatus;
}

interface NodeSnapshot {
  id:          string;
  status:      ExecutionNode["status"];
  retryCount:  number;
  result?:     unknown;
  error?:      string;
  startedAt?:  number;
  completedAt?:number;
  durationMs?: number;
}

// ── Serialization ─────────────────────────────────────────────────────────────

export function createCheckpoint(
  graph:        ExecutionGraph,
  checkpointAt: string,
): GraphCheckpoint {
  const nodeSnapshots: NodeSnapshot[] = [...graph.nodes.values()].map(n => ({
    id:          n.id,
    status:      n.status,
    retryCount:  n.retryCount,
    result:      n.result,
    error:       n.error,
    startedAt:   n.startedAt,
    completedAt: n.completedAt,
    durationMs:  n.durationMs,
  }));

  return {
    runId:        graph.id,
    projectId:    graph.projectId,
    goal:         graph.goal,
    ts:           Date.now(),
    checkpointAt,
    nodeSnapshots,
    completedIds: [...graph.completedIds],
    failedIds:    [...graph.failedIds],
    graphStatus:  graph.status,
  };
}

export function restoreCheckpoint(
  graph:      ExecutionGraph,
  checkpoint: GraphCheckpoint,
): void {
  graph.completedIds = new Set(checkpoint.completedIds);
  graph.failedIds    = new Set(checkpoint.failedIds);
  graph.status       = checkpoint.graphStatus;
  graph.checkpointAt = checkpoint.checkpointAt;
  graph.currentWave  = [];

  for (const snap of checkpoint.nodeSnapshots) {
    const node = graph.nodes.get(snap.id);
    if (!node) continue;
    node.status      = snap.status;
    node.retryCount  = snap.retryCount;
    node.result      = snap.result;
    node.error       = snap.error;
    node.startedAt   = snap.startedAt;
    node.completedAt = snap.completedAt;
    node.durationMs  = snap.durationMs;
  }

  console.log(`[graph-state] Restored checkpoint at node "${checkpoint.checkpointAt}"`);
}

// ── Replay ────────────────────────────────────────────────────────────────────

/**
 * Mark all nodes BEFORE checkpointAt as already-complete.
 * Nodes AT or AFTER checkpointAt are reset to pending for re-execution.
 */
export function prepareReplay(
  graph:      ExecutionGraph,
  fromNodeId: string,
): void {
  for (const node of graph.nodes.values()) {
    if (node.id === fromNodeId) {
      // Reset from here onwards
      node.status     = "pending";
      node.retryCount = 0;
      node.result     = undefined;
      node.error      = undefined;
      graph.completedIds.delete(node.id);
      graph.failedIds.delete(node.id);
    }
    // Nodes that depended on the reset node also reset
    if (node.dependsOn.includes(fromNodeId)) {
      node.status     = "pending";
      node.retryCount = 0;
      graph.completedIds.delete(node.id);
      graph.failedIds.delete(node.id);
    }
  }
  graph.currentWave = [];
  console.log(`[graph-state] Replay prepared from node "${fromNodeId}"`);
}

// ── State serialization for persistence ──────────────────────────────────────

export function serializeGraph(graph: ExecutionGraph): string {
  return JSON.stringify({
    id:          graph.id,
    projectId:   graph.projectId,
    goal:        graph.goal,
    status:      graph.status,
    completedIds:[...graph.completedIds],
    failedIds:   [...graph.failedIds],
    nodes:       [...graph.nodes.values()],
    edges:       graph.edges,
    createdAt:   graph.createdAt,
    startedAt:   graph.startedAt,
    completedAt: graph.completedAt,
  });
}
