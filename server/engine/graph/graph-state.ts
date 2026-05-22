/**
 * graph-state.ts
 *
 * Lightweight checkpoint + restore system for execution graphs.
 * Allows pausing and replaying partial execution from a safe point.
 *
 * FIXED: prepareReplay now resets the FULL transitive downstream subtree
 * (not just the target node and its direct dependents).
 */

import type { ExecutionGraph, ExecutionNode, GraphStatus } from "./graph-types.ts";

export interface GraphCheckpoint {
  runId:         string;
  projectId:     number;
  goal:          string;
  ts:            number;
  checkpointAt:  string;        // nodeId of last success
  nodeSnapshots: NodeSnapshot[];
  completedIds:  string[];
  failedIds:     string[];
  graphStatus:   GraphStatus;
}

interface NodeSnapshot {
  id:           string;
  status:       ExecutionNode["status"];
  retryCount:   number;
  result?:      unknown;
  error?:       string;
  startedAt?:   number;
  completedAt?: number;
  durationMs?:  number;
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
 * Reset the target node AND its full transitive downstream subtree to "pending".
 *
 * FIXED: Previously only reset the target + direct dependents. Now uses BFS to
 * find every descendant node so that a re-run from checkpoint is complete and
 * deterministic — no stale "success" statuses surviving into the replay.
 */
export function prepareReplay(
  graph:      ExecutionGraph,
  fromNodeId: string,
): void {
  // BFS: collect the full set of nodes to reset
  const toReset = new Set<string>();
  const queue   = [fromNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toReset.has(current)) continue;
    toReset.add(current);

    // Any node whose dependsOn includes `current` is a downstream dependent
    for (const node of graph.nodes.values()) {
      if (!toReset.has(node.id) && node.dependsOn.includes(current)) {
        queue.push(node.id);
      }
    }
  }

  // Reset all collected nodes
  for (const nodeId of toReset) {
    const node = graph.nodes.get(nodeId);
    if (!node) continue;
    node.status     = "pending";
    node.retryCount = 0;
    node.result     = undefined;
    node.error      = undefined;
    graph.completedIds.delete(nodeId);
    graph.failedIds.delete(nodeId);
  }

  graph.currentWave = [];
  console.log(`[graph-state] Replay prepared from node "${fromNodeId}" — reset ${toReset.size} nodes`);
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
