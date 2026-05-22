/**
 * parallel-runner.ts
 *
 * Executes a batch of ready nodes in parallel with:
 * - Concurrency cap (MAX_PARALLEL from graph-types)
 * - Per-node timeout enforcement
 * - Retry scheduling on failure
 * - Backpressure when at capacity
 *
 * FIXED: Retry delay is no longer blocking the parallel worker slot.
 * Retrying nodes are immediately released from the current batch and
 * re-queued as "pending" for the next wave, freeing concurrency capacity.
 */

import { setNodeStatus } from "./execution-graph.ts";
import { MAX_PARALLEL }  from "./graph-types.ts";
import type { ExecutionGraph, ExecutionNode, GraphResult } from "./graph-types.ts";

export type NodeExecutor = (
  node:  ExecutionNode,
  graph: ExecutionGraph,
) => Promise<unknown>;

export interface RunnerOptions {
  executor:        NodeExecutor;
  timeoutMs:       number;
  onNodeStart?:    (node: ExecutionNode) => void;
  onNodeComplete?: (node: ExecutionNode, result: unknown) => void;
  onNodeFailed?:   (node: ExecutionNode, error: Error) => void;
}

// ── Node runner ───────────────────────────────────────────────────────────────

async function runNode(
  node:  ExecutionNode,
  graph: ExecutionGraph,
  opts:  RunnerOptions,
): Promise<void> {
  setNodeStatus(graph, node.id, "running");
  opts.onNodeStart?.(node);

  const timeoutSignal = AbortSignal.timeout(opts.timeoutMs);

  try {
    const resultPromise = opts.executor(node, graph);

    const result = await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) => {
        timeoutSignal.addEventListener("abort", () =>
          reject(new Error(`Node "${node.id}" timed out after ${opts.timeoutMs}ms`)),
        );
      }),
    ]);

    setNodeStatus(graph, node.id, "success", result);
    opts.onNodeComplete?.(node, result);

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    if (node.retryCount < node.maxRetries) {
      // FIXED: increment retry counter and schedule re-queue via async timer.
      // The batch does NOT await this delay — the worker slot is freed immediately.
      node.retryCount++;
      node.status = "retrying";
      graph.currentWave = graph.currentWave.filter(id => id !== node.id);

      const delay = node.retryStrategy === "exponential"
        ? Math.min(30_000, 1_000 * 2 ** (node.retryCount - 1))
        : 1_000;

      // Schedule re-queue without blocking this slot
      setTimeout(() => {
        if (node.status === "retrying") {
          node.status = "pending";  // re-enters readiness check in next wave
        }
      }, delay);

      // Don't set to "failed" — let the graph-engine pick it up next wave
    } else {
      setNodeStatus(graph, node.id, "failed", undefined, error.message);
      opts.onNodeFailed?.(node, error);
    }
  }
}

// ── Parallel batch runner ─────────────────────────────────────────────────────

/**
 * Execute `nodes` in parallel, capped at MAX_PARALLEL.
 * Returns when all nodes in this batch are settled.
 *
 * FIXED: Retry slots are no longer held; delayed re-queuing is non-blocking.
 */
export async function runParallelBatch(
  nodes: ExecutionNode[],
  graph: ExecutionGraph,
  opts:  RunnerOptions,
): Promise<{ passed: string[]; failed: string[] }> {
  const passed: string[] = [];
  const failed: string[] = [];

  const cap    = Math.min(nodes.length, MAX_PARALLEL);
  const chunks: ExecutionNode[][] = [];
  for (let i = 0; i < nodes.length; i += cap) {
    chunks.push(nodes.slice(i, i + cap));
  }

  for (const chunk of chunks) {
    // Add chunk to currentWave before parallel launch
    for (const n of chunk) {
      if (!graph.currentWave.includes(n.id)) {
        graph.currentWave.push(n.id);
      }
    }

    const results = await Promise.allSettled(
      chunk.map(n => runNode(n, graph, opts)),
    );

    results.forEach((r, i) => {
      const nodeId = chunk[i].id;
      const status = chunk[i].status;
      if (r.status === "fulfilled" && status === "success") {
        passed.push(nodeId);
      } else if (status === "failed") {
        failed.push(nodeId);
      }
      // status === "retrying" or "pending" → not in passed/failed — graph re-runs next wave
    });
  }

  return { passed, failed };
}

/** Aggregate all node results into a GraphResult. */
export function aggregateResults(
  graph:      ExecutionGraph,
  totalMs:    number,
  stopReason: GraphResult["stopReason"],
): GraphResult {
  const errors = [...graph.nodes.values()]
    .filter(n => n.status === "failed")
    .map(n => ({ nodeId: n.id, error: n.error ?? "Unknown error" }));

  return {
    success:   errors.length === 0 && graph.failedIds.size === 0,
    completed: graph.completedIds.size,
    failed:    graph.failedIds.size,
    skipped:   [...graph.nodes.values()].filter(n => n.status === "skipped").length,
    totalMs,
    errors,
    stopReason,
  };
}
