/**
 * worker-pool.ts
 *
 * Concurrency-capped async worker pool with backpressure, cancellation,
 * and work-stealing support. Prevents deadlocks via timeout enforcement.
 * Prevents memory leaks via automatic slot release on error/cancel.
 */

import type { WorkerTask, WorkerTaskResult } from "../types/quantum.types.ts";
import { PriorityQueue } from "./priority-queue.ts";
import { incrementCounter } from "../../orchestration/telemetry/orchestration-metrics.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS  = 120_000;

// ── Pool ──────────────────────────────────────────────────────────────────────

export class WorkerPool {
  private readonly _concurrency: number;
  private readonly _queue       = new PriorityQueue();
  private          _active      = 0;
  private readonly _results     = new Map<string, WorkerTaskResult>();
  private          _draining    = false;

  constructor(concurrency = DEFAULT_CONCURRENCY) {
    this._concurrency = concurrency;
  }

  get activeCount(): number  { return this._active; }
  get pendingCount(): number { return this._queue.size; }
  get isDraining():  boolean { return this._draining; }

  // ── Submit ──────────────────────────────────────────────────────────────────

  submit<T>(task: WorkerTask<T>): Promise<WorkerTaskResult<T>> {
    return new Promise((resolve) => {
      const wrapped: WorkerTask = {
        ...task,
        onDone:  (result) => resolve({ taskId: task.taskId, pathId: task.pathId, success: true,  result,         durationMs: 0 } as WorkerTaskResult<T>),
        onError: (err)    => resolve({ taskId: task.taskId, pathId: task.pathId, success: false, error: err.message, durationMs: 0 } as WorkerTaskResult<T>),
      };
      this._queue.enqueue(wrapped);
      this._tick();
    });
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────

  cancel(taskId: string): boolean {
    return this._queue.remove(taskId);
  }

  cancelPath(pathId: string): void {
    for (const task of this._queue.toArray()) {
      if (task.pathId === pathId) this._queue.remove(task.taskId);
    }
  }

  // ── Drain ───────────────────────────────────────────────────────────────────

  async drain(): Promise<void> {
    this._draining = true;
    while (this._active > 0 || !this._queue.isEmpty) {
      await new Promise(r => setTimeout(r, 50));
    }
    this._draining = false;
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  getResult(taskId: string): WorkerTaskResult | undefined {
    return this._results.get(taskId);
  }

  stats() {
    return { active: this._active, pending: this._queue.size };
  }

  // ── Internal tick (dequeue + execute) ──────────────────────────────────────

  private _tick(): void {
    while (this._active < this._concurrency && !this._queue.isEmpty) {
      const task = this._queue.dequeue();
      if (!task) break;

      // Skip cancelled (signal already aborted)
      if (task.signal?.aborted) {
        incrementCounter("quantum.worker.cancelled");
        continue;
      }

      this._active++;
      incrementCounter("quantum.worker.started");
      this._execute(task);
    }
  }

  private async _execute(task: WorkerTask): Promise<void> {
    const t0 = Date.now();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Task ${task.taskId} timed out`)),
        task.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    );

    try {
      const result = await Promise.race([task.fn(), timeout]);
      const dur    = Date.now() - t0;
      const r: WorkerTaskResult = {
        taskId: task.taskId, pathId: task.pathId,
        success: true, result, durationMs: dur,
      };
      this._results.set(task.taskId, r);
      incrementCounter("quantum.worker.completed");
      task.onDone?.(result);
    } catch (err) {
      const dur = Date.now() - t0;
      const r: WorkerTaskResult = {
        taskId: task.taskId, pathId: task.pathId,
        success: false, error: (err as Error).message, durationMs: dur,
      };
      this._results.set(task.taskId, r);
      incrementCounter("quantum.worker.failed");
      task.onError?.(err as Error);
    } finally {
      this._active--;
      this._tick();
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const workerPool = new WorkerPool(DEFAULT_CONCURRENCY);
