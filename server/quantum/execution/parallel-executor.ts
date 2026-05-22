/**
 * server/quantum/execution/parallel-executor.ts
 *
 * High-level API for submitting a set of PoolTasks to the centralized
 * Worker Pool and collecting results as a typed BatchResult.
 *
 * Replaces raw Promise.all / Promise.allSettled call sites with governed
 * execution through the backpressure-aware, priority-scheduled pool.
 */

import { v4 as uuidv4 }        from "uuid";
import { ExecutionBatch }      from "./execution-batch.ts";
import { centralWorkerPool }   from "../scheduler/worker-pool.ts";
import type { PoolTask }       from "../scheduler/worker-types.ts";
import type { BatchResult }    from "./execution-batch.ts";
import { bus }                 from "../../infrastructure/events/bus.ts";

// ── Options ───────────────────────────────────────────────────────────────────

export interface ParallelExecutionOptions {
  batchId?:    string;
  runId:       string;
  /** If true, returns when ANY task completes rather than waiting for all. */
  earlyExit?:  boolean;
  /** Max tasks to run in this batch at once (slice into sub-batches if needed). */
  batchLimit?: number;
}

// ── Executor ──────────────────────────────────────────────────────────────────

class ParallelExecutor {
  /**
   * Submit a list of tasks through the centralWorkerPool and collect results.
   * Never throws — failed tasks are captured in BatchResult.failed.
   */
  async executeBatch<T>(
    tasks: PoolTask<T>[],
    opts:  ParallelExecutionOptions,
  ): Promise<BatchResult<T>> {
    const batchId = opts.batchId ?? uuidv4();
    const t0      = Date.now();

    bus.emit("agent.event", {
      runId:     opts.runId,
      eventType: "executor.batch.started" as any,
      phase:     "parallel-executor",
      ts:        t0,
      payload:   { batchId, taskCount: tasks.length },
    });

    const slice  = opts.batchLimit ?? tasks.length;
    const chunks = this.chunk(tasks, slice);
    const batch  = new ExecutionBatch<T>(batchId);

    for (const chunk of chunks) {
      for (const task of chunk) {
        batch.add({
          taskId:  task.id,
          runId:   task.runId,
          promise: centralWorkerPool.submit<T>(task),
        });
      }
    }

    const result = await batch.collect();

    bus.emit("agent.event", {
      runId:     opts.runId,
      eventType: "executor.batch.completed" as any,
      phase:     "parallel-executor",
      ts:        Date.now(),
      payload:   {
        batchId,
        total:      result.totalTasks,
        succeeded:  result.succeeded.length,
        failed:     result.failed.length,
        durationMs: Date.now() - t0,
      },
    });

    return result;
  }

  /**
   * Submit a single task and await its result.
   */
  async executeOne<T>(task: PoolTask<T>): Promise<T> {
    const result = await centralWorkerPool.submit<T>(task);
    if (!result.success) {
      throw new Error(result.error ?? `Task "${task.id}" failed`);
    }
    return result.data as T;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  }
}

export const parallelExecutor = new ParallelExecutor();
