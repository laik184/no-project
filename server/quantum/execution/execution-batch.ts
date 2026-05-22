/**
 * server/quantum/execution/execution-batch.ts
 *
 * Manages a typed set of concurrent pool submissions as a single unit.
 * Tracks individual task results, partial failures, and overall batch health.
 * Designed for the parallel-executor and graph-engine-bridge.
 */

import type { PoolResult } from "../scheduler/worker-types.ts";

// ── Batch types ───────────────────────────────────────────────────────────────

export interface BatchEntry<T = unknown> {
  taskId:  string;
  runId:   string;
  promise: Promise<PoolResult<T>>;
}

export interface BatchResult<T = unknown> {
  batchId:     string;
  totalTasks:  number;
  succeeded:   PoolResult<T>[];
  failed:      PoolResult<T>[];
  durationMs:  number;
  allSucceeded: boolean;
  anySucceeded: boolean;
}

// ── Execution batch ───────────────────────────────────────────────────────────

export class ExecutionBatch<T = unknown> {
  private readonly entries: BatchEntry<T>[] = [];
  private readonly startedAt = Date.now();

  constructor(public readonly batchId: string) {}

  /** Add a pre-submitted task promise to this batch. */
  add(entry: BatchEntry<T>): void {
    this.entries.push(entry);
  }

  get size(): number { return this.entries.length; }
  get isEmpty(): boolean { return this.entries.length === 0; }

  /**
   * Wait for all entries to settle (using Promise.allSettled for fail-safety).
   * Never throws — failed submissions appear in the `failed` list.
   */
  async collect(): Promise<BatchResult<T>> {
    const settled = await Promise.allSettled(this.entries.map(e => e.promise));
    const succeeded: PoolResult<T>[] = [];
    const failed:    PoolResult<T>[] = [];

    settled.forEach((outcome, i) => {
      if (outcome.status === "fulfilled") {
        const r = outcome.value;
        if (r.success) {
          succeeded.push(r);
        } else {
          failed.push(r);
        }
      } else {
        // The submission promise itself rejected — treat as failed result
        const entry = this.entries[i];
        failed.push({
          taskId:     entry.taskId,
          runId:      entry.runId,
          success:    false,
          error:      outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
          durationMs: Date.now() - this.startedAt,
          retryCount: 0,
          workerId:   "none",
        });
      }
    });

    return {
      batchId:      this.batchId,
      totalTasks:   this.entries.length,
      succeeded,
      failed,
      durationMs:   Date.now() - this.startedAt,
      allSucceeded: failed.length === 0,
      anySucceeded: succeeded.length > 0,
    };
  }

  /**
   * Wait for the first settled task (success or failure) to arrive.
   * Useful for streaming partial results.
   */
  async firstSettled(): Promise<PoolResult<T>> {
    return Promise.any(this.entries.map(e => e.promise));
  }
}
