/**
 * rollback-graph.ts
 *
 * Manages rollback execution when a critical node fails.
 * Traverses the DAG in reverse and executes rollback nodes.
 */

import { setNodeStatus } from "./execution-graph.ts";
import type { ExecutionGraph, ExecutionNode } from "./graph-types.ts";

export interface RollbackPlan {
  triggerNodeId: string;
  nodesToRollback: string[];    // in reverse topological order
  estimatedSteps: number;
}

// ── Plan builder ──────────────────────────────────────────────────────────────

/**
 * Build a rollback plan starting from the failed node.
 * Traverses backwards through completed nodes that have rollback handlers.
 */
export function buildRollbackPlan(
  graph:         ExecutionGraph,
  failedNodeId:  string,
): RollbackPlan {
  const toRollback: string[] = [];
  const visited = new Set<string>();

  function collectAncestors(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) return;

    // Only rollback nodes that completed AND have a rollback defined
    if (node.status === "success" && node.rollbackNodeId) {
      toRollback.push(nodeId);
    }

    // Walk backwards through dependsOn chain
    for (const depId of node.dependsOn) {
      collectAncestors(depId);
    }
  }

  collectAncestors(failedNodeId);

  // Reverse so we undo most-recent first
  const ordered = toRollback.reverse();

  return {
    triggerNodeId:   failedNodeId,
    nodesToRollback: ordered,
    estimatedSteps:  ordered.length,
  };
}

// ── Rollback executor ─────────────────────────────────────────────────────────

export type RollbackExecutor = (
  rollbackNode: ExecutionNode,
  originalNode: ExecutionNode,
  graph:        ExecutionGraph,
) => Promise<void>;

export async function executeRollback(
  graph:    ExecutionGraph,
  plan:     RollbackPlan,
  executor: RollbackExecutor,
): Promise<{ rolledBack: string[]; rollbackFailed: string[] }> {
  const rolledBack: string[]      = [];
  const rollbackFailed: string[]  = [];

  for (const nodeId of plan.nodesToRollback) {
    const originalNode  = graph.nodes.get(nodeId);
    if (!originalNode?.rollbackNodeId) continue;

    const rollbackNode = graph.nodes.get(originalNode.rollbackNodeId);
    if (!rollbackNode) {
      console.warn(`[rollback-graph] Rollback node not found: ${originalNode.rollbackNodeId}`);
      continue;
    }

    try {
      console.log(`[rollback-graph] Rolling back: ${nodeId} via ${rollbackNode.id}`);
      setNodeStatus(graph, rollbackNode.id, "running");

      await executor(rollbackNode, originalNode, graph);

      setNodeStatus(graph, nodeId,         "rolled-back");
      setNodeStatus(graph, rollbackNode.id, "success");
      rolledBack.push(nodeId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[rollback-graph] Rollback failed for ${nodeId}: ${msg}`);
      setNodeStatus(graph, rollbackNode.id, "failed", undefined, msg);
      rollbackFailed.push(nodeId);
    }
  }

  return { rolledBack, rollbackFailed };
}

// ── Skip blocked ──────────────────────────────────────────────────────────────

/**
 * Mark all nodes that are blocked by a permanently failed node as "skipped".
 */
export function skipBlockedNodes(graph: ExecutionGraph, failedNodeId: string): string[] {
  const skipped: string[] = [];

  for (const node of graph.nodes.values()) {
    if (node.status !== "pending") continue;
    if (node.dependsOn.includes(failedNodeId)) {
      setNodeStatus(graph, node.id, "skipped", undefined, `Blocked by failed node "${failedNodeId}"`);
      skipped.push(node.id);
    }
  }

  return skipped;
}
