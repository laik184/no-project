/**
 * dependency-resolver.ts
 *
 * Determines which nodes are ready to execute given current graph state.
 * Implements AND-semantics (all deps complete) and OR-semantics (any dep complete).
 */

import type { ExecutionGraph, ExecutionNode } from "./graph-types.ts";

// ── Readiness ─────────────────────────────────────────────────────────────────

function isNodeDone(graph: ExecutionGraph, nodeId: string): boolean {
  return graph.completedIds.has(nodeId);
}

function isNodeFailed(graph: ExecutionGraph, nodeId: string): boolean {
  return graph.failedIds.has(nodeId);
}

/**
 * Returns true when all hard dependencies are met and the node is pending/ready.
 * AND semantics: all `dependsOn` must be in completedIds.
 * OR  semantics: at least one `dependsOnAny` must be in completedIds.
 */
export function isNodeReady(graph: ExecutionGraph, node: ExecutionNode): boolean {
  if (!["pending", "ready"].includes(node.status)) return false;
  if (graph.currentWave.includes(node.id))         return false;

  // AND dependencies
  const andMet = node.dependsOn.every(dep => isNodeDone(graph, dep));
  if (!andMet) return false;

  // OR dependencies (if any defined)
  if (node.dependsOnAny && node.dependsOnAny.length > 0) {
    const orMet = node.dependsOnAny.some(dep => isNodeDone(graph, dep));
    if (!orMet) return false;
  }

  // Block if any required dep permanently failed
  const blockedByFailure = node.dependsOn.some(dep => {
    const depNode = graph.nodes.get(dep);
    return depNode && depNode.status === "failed" && depNode.retryCount >= depNode.maxRetries;
  });

  return !blockedByFailure;
}

/**
 * Collect all currently ready nodes (AND/OR deps satisfied, not yet executing).
 * Returns them sorted by depth (shallowest first) for deterministic wave ordering.
 */
export function getReadyNodes(graph: ExecutionGraph): ExecutionNode[] {
  const ready: ExecutionNode[] = [];
  for (const node of graph.nodes.values()) {
    if (isNodeReady(graph, node)) {
      ready.push(node);
    }
  }
  return ready.sort((a, b) => nodeDepth(graph, a.id) - nodeDepth(graph, b.id));
}

/**
 * Nodes that are permanently blocked (deps failed and no retries left).
 */
export function getBlockedNodes(graph: ExecutionGraph): ExecutionNode[] {
  const blocked: ExecutionNode[] = [];
  for (const node of graph.nodes.values()) {
    if (node.status !== "pending") continue;
    const blockedByDep = node.dependsOn.some(dep => {
      const depNode = graph.nodes.get(dep);
      return depNode && depNode.status === "failed" && depNode.retryCount >= depNode.maxRetries;
    });
    if (blockedByDep) blocked.push(node);
  }
  return blocked;
}

/**
 * Find nodes that are currently executing (status=running).
 */
export function getRunningNodes(graph: ExecutionGraph): ExecutionNode[] {
  return [...graph.nodes.values()].filter(n => n.status === "running");
}

// ── Depth computation ─────────────────────────────────────────────────────────

const _depthCache = new WeakMap<ExecutionGraph, Map<string, number>>();

function nodeDepth(graph: ExecutionGraph, nodeId: string): number {
  let cache = _depthCache.get(graph);
  if (!cache) { cache = new Map(); _depthCache.set(graph, cache); }
  if (cache.has(nodeId)) return cache.get(nodeId)!;

  const node = graph.nodes.get(nodeId);
  if (!node || node.dependsOn.length === 0) {
    cache.set(nodeId, 0);
    return 0;
  }

  const d = 1 + Math.max(...node.dependsOn.map(dep => nodeDepth(graph, dep)));
  cache.set(nodeId, d);
  return d;
}

/** Critical path: the longest dependency chain (determines minimum serial time). */
export function criticalPathLength(graph: ExecutionGraph): number {
  if (graph.nodes.size === 0) return 0;
  return Math.max(...[...graph.nodes.keys()].map(id => nodeDepth(graph, id)));
}

/** Nodes that can safely execute in parallel (no ordering relationship). */
export function findParallelSets(graph: ExecutionGraph): ExecutionNode[][] {
  const byDepth = new Map<number, ExecutionNode[]>();
  for (const node of graph.nodes.values()) {
    const d = nodeDepth(graph, node.id);
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(node);
  }
  return [...byDepth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, nodes]) => nodes);
}
