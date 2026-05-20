/**
 * parallel-runner.ts
 *
 * Executes a batch of ready nodes in parallel with:
 * - Concurrency cap (MAX_PARALLEL from graph-types)
 * - Per-node timeout enforcement
 * - Retry scheduling on failure
 * - Backpressure when at capacity
 */

import { setNodeStatus } from "./execution-graph.ts";
import { MAX_PARALLEL }  from "./graph-types.ts";
import type { ExecutionGraph, ExecutionNode, GraphResult } from "./graph-types.ts";

export type NodeExecutor = (
  node:  ExecutionNode,
  graph: ExecutionGraph,
) => Promise<unknown>;

export interface RunnerOptions {
  executor:  NodeExecutor;
  timeoutMs: number;
  onNodeStart?:    (node: ExecutionNode) => void;
  onNodeComplete?: (node: ExecutionNode, result: unknown) => void;
  onNodeFailed?:   (node: ExecutionNode, error: Error) => void;
}

// ── Node runner ───────────────────────────────────────────────────────────────

async function runNode(
  node:    ExecutionNode,
  graph:   ExecutionGraph,
  opts:    RunnerOptions,
): Promise<void> {
  setNodeStatus(graph, node.id, "running");
  opts.onNodeStart?.(node);

  const timeoutSignal = AbortSignal.timeout(opts.timeoutMs);

  try {
    const resultPromise = opts.executor(node, graph);

    // Race the executor against the timeout signal
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
      // Schedule retry
      node.retryCount++;
      node.status = "retrying";

      const delay = node.retryStrategy === "exponential"
        ? Math.min(30_000, 1_000 * 2 ** (node.retryCount - 1))
        : 1_000;

      await new Promise(r => setTimeout(r, delay));
      node.status = "pending";  // re-queue for next wave
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
 */
export async function runParallelBatch(
  nodes:  ExecutionNode[],
  graph:  ExecutionGraph,
  opts:   RunnerOptions,
): Promise<{ passed: string[]; failed: string[] }> {
  const passed: string[] = [];
  const failed: string[] = [];

  const cap     = Math.min(nodes.length, MAX_PARALLEL);
  const chunks  = [];
  for (let i = 0; i < nodes.length; i += cap) {
    chunks.push(nodes.slice(i, i + cap));
  }

  for (const chunk of chunks) {
    // Add chunk to currentWave
    graph.currentWave.push(...chunk.map(n => n.id));

    const results = await Promise.allSettled(
      chunk.map(n => runNode(n, graph, opts)),
    );

    results.forEach((r, i) => {
      const nodeId = chunk[i].id;
      if (r.status === "fulfilled" && chunk[i].status === "success") {
        passed.push(nodeId);
      } else {
        failed.push(nodeId);
      }
    });
  }

  return { passed, failed };
}

/** Aggregate all node results into a GraphResult. */
export function aggregateResults(
  graph:       ExecutionGraph,
  totalMs:     number,
  stopReason:  GraphResult["stopReason"],
): GraphResult {
  const errors = [...graph.nodes.values()]
    .filter(n => n.status === "failed")
    .map(n => ({ nodeId: n.id, error: n.error ?? "Unknown error" }));

  return {
    success:    errors.length === 0 && graph.failedIds.size === 0,
    completed:  graph.completedIds.size,
    failed:     graph.failedIds.size,
    skipped:    [...graph.nodes.values()].filter(n => n.status === "skipped").length,
    totalMs,
    errors,
    stopReason,
  };
}
