/**
 * dag-scheduler.ts
 *
 * Public scheduling API for the DAG engine.
 * Wraps node-scheduler + dependency-resolver with a clean interface.
 *
 * Single responsibility: scheduling queries. No execution.
 */

import {
  buildSchedule,
  getNextWave,
  describeSchedule,
} from "../graph/node-scheduler.ts";
import {
  getReadyNodes,
  getBlockedNodes,
  getRunningNodes,
  criticalPathLength,
  findParallelSets,
} from "../graph/dependency-resolver.ts";
import { MAX_PARALLEL } from "../graph/graph-types.ts";
import type { ExecutionGraph, ExecutionNode } from "../graph/graph-types.ts";
import type { SchedulerWave } from "../graph/node-scheduler.ts";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the full execution schedule as a series of waves.
 * Pure analysis — does NOT mutate graph state.
 */
export function scheduleGraph(graph: ExecutionGraph): SchedulerWave[] {
  return buildSchedule(graph);
}

/**
 * Get the next batch of ready nodes to execute (respects MAX_PARALLEL).
 */
export function getReadyBatch(
  graph:          ExecutionGraph,
  maxConcurrent?: number,
): ExecutionNode[] {
  const ready = getReadyNodes(graph);
  const cap   = Math.min(maxConcurrent ?? MAX_PARALLEL, MAX_PARALLEL);
  return ready.slice(0, cap);
}

/**
 * Compute the critical path through the DAG.
 * Returns the ordered list of node IDs forming the longest dependency chain.
 */
export function computeCriticalPath(graph: ExecutionGraph): string[] {
  const parallelSets = findParallelSets(graph);
  // Critical path = deepest set (last parallel layer)
  const deepest = parallelSets[parallelSets.length - 1] ?? [];
  return deepest.map(n => n.id);
}

/** Length (depth) of the critical path. */
export function criticalPathDepth(graph: ExecutionGraph): number {
  return criticalPathLength(graph);
}

/** Nodes that can provably execute in parallel. */
export function getParallelSets(graph: ExecutionGraph): ExecutionNode[][] {
  return findParallelSets(graph);
}

/** Nodes permanently blocked by failed dependencies. */
export function getBlocked(graph: ExecutionGraph): ExecutionNode[] {
  return getBlockedNodes(graph);
}

/** Currently running nodes. */
export function getRunning(graph: ExecutionGraph): ExecutionNode[] {
  return getRunningNodes(graph);
}

/** Human-readable schedule description for logs. */
export function describeGraph(graph: ExecutionGraph): string {
  return describeSchedule(buildSchedule(graph));
}

/** Scheduling health snapshot. */
export function schedulerSnapshot(graph: ExecutionGraph): {
  totalNodes:    number;
  ready:         number;
  running:       number;
  blocked:       number;
  completed:     number;
  failed:        number;
  criticalDepth: number;
  parallelSets:  number;
  maxParallel:   number;
} {
  return {
    totalNodes:    graph.nodes.size,
    ready:         getReadyNodes(graph).length,
    running:       getRunningNodes(graph).length,
    blocked:       getBlockedNodes(graph).length,
    completed:     graph.completedIds.size,
    failed:        graph.failedIds.size,
    criticalDepth: criticalPathLength(graph),
    parallelSets:  findParallelSets(graph).length,
    maxParallel:   MAX_PARALLEL,
  };
}
