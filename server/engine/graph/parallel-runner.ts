/**
 * parallel-runner.ts
 *
 * Executes a batch of ready DAG nodes in parallel by routing each node
 * through the CentralWorkerPool — replacing raw Promise.allSettled with
 * governed, priority-scheduled, backpressure-aware execution.
 *
 * Architecture upgrade (Phase 1)
 * ──────────────────────────────
 *   BEFORE: raw Promise.allSettled with manual MAX_PARALLEL chunking
 *   AFTER:  every DAG node is a PoolTask submitted to CentralWorkerPool
 *
 * Safety guarantees
 * ─────────────────
 *   ✅ CentralWorkerPool enforces system-wide concurrency cap
 *   ✅ Backpressure gates admission at saturation threshold — fail-closed
 *   ✅ Per-node inner timeout still fires (AbortSignal.timeout inside runNode)
 *   ✅ Pool hard timeout as outer safety net (nodeTimeoutMs + 10s buffer)
 *   ✅ Retry logic preserved: node.retryCount / node.maxRetries still managed here
 *   ✅ Worker telemetry emitted by pool for every node dispatched
 *   ✅ runId threaded through for per-run concurrency limiting
 */

import { v4 as uuidv4 }      from "uuid";
import { setNodeStatus }      from "./execution-graph.ts";
import { MAX_PARALLEL }       from "./graph-types.ts";
import { centralWorkerPool }  from "../../quantum/scheduler/worker-pool.ts";
import { TaskPriority }       from "../../quantum/scheduler/worker-types.ts";
import type { PoolTask }      from "../../quantum/scheduler/worker-types.ts";
import type { ExecutionGraph, ExecutionNode, GraphResult } from "./graph-types.ts";

export type NodeExecutor = (
  node:  ExecutionNode,
  graph: ExecutionGraph,
) => Promise<unknown>;

export interface RunnerOptions {
  executor:        NodeExecutor;
  timeoutMs:       number;
  /** runId for pool per-run concurrency limiting and telemetry. */
  runId?:          string;
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
      node.retryCount++;
      node.status = "retrying";
      graph.currentWave = graph.currentWave.filter(id => id !== node.id);

      const delay = node.retryStrategy === "exponential"
        ? Math.min(30_000, 1_000 * 2 ** (node.retryCount - 1))
        : 1_000;

      setTimeout(() => {
        if (node.status === "retrying") node.status = "pending";
      }, delay);
    } else {
      setNodeStatus(graph, node.id, "failed", undefined, error.message);
      opts.onNodeFailed?.(node, error);
    }
  }
}

// ── Parallel batch runner ─────────────────────────────────────────────────────

/**
 * Execute `nodes` as governed PoolTasks via CentralWorkerPool.
 * Pool enforces system-wide concurrency; wave-level cap (MAX_PARALLEL) still
 * applied before submission to bound the batch size.
 */
export async function runParallelBatch(
  nodes: ExecutionNode[],
  graph: ExecutionGraph,
  opts:  RunnerOptions,
): Promise<{ passed: string[]; failed: string[] }> {
  const passed:  string[] = [];
  const failed:  string[] = [];
  const runId   = opts.runId ?? graph.id ?? uuidv4();

  // Wave-level cap: slice into batches of MAX_PARALLEL
  const cap    = Math.min(nodes.length, MAX_PARALLEL);
  const chunks: ExecutionNode[][] = [];
  for (let i = 0; i < nodes.length; i += cap) {
    chunks.push(nodes.slice(i, i + cap));
  }

  for (const chunk of chunks) {
    // Register chunk in currentWave before dispatch
    for (const n of chunk) {
      if (!graph.currentWave.includes(n.id)) graph.currentWave.push(n.id);
    }

    // Wrap each node as a PoolTask — pool governs concurrency + backpressure
    const poolTasks: PoolTask<void>[] = chunk.map(node => ({
      id:            node.id,
      runId,
      priority:      TaskPriority.NORMAL,
      timeoutMs:     opts.timeoutMs + 10_000,  // hard outer cap > inner timeout
      maxRetries:    0,                         // node retry logic lives in runNode
      taskType:      "dag-node",
      executionMode: "parallel" as const,
      fn:            () => runNode(node, graph, opts),
      metadata:      { nodeLabel: node.label, nodeType: node.type },
    }));

    // Submit all — pool manages admission and concurrency
    const poolResults = await Promise.all(
      poolTasks.map(task => centralWorkerPool.submit<void>(task)),
    );

    poolResults.forEach((result, i) => {
      const node   = chunk[i];
      const status = node.status;

      if (!result.success) {
        // Pool-level rejection (backpressure / hard timeout) not caught by runNode
        if (node.status === "running") {
          setNodeStatus(graph, node.id, "failed", undefined, result.error ?? "Pool rejection");
          opts.onNodeFailed?.(node, new Error(result.error ?? "Pool rejection"));
        }
      }

      if (status === "success") {
        passed.push(node.id);
      } else if (status === "failed") {
        failed.push(node.id);
      }
      // status === "retrying" / "pending" → re-enters next wave
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
