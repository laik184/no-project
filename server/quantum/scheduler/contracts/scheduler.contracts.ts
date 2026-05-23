/**
 * server/quantum/scheduler/contracts/scheduler.contracts.ts
 *
 * Abstract interface contracts for the Quantum Scheduler subsystem.
 *
 * These interfaces decouple consumers from concrete implementations,
 * enabling future migration to Redis-backed / distributed schedulers
 * without changing call sites.
 *
 * Design rules
 * ────────────
 *   • No concrete imports — pure type/interface declarations only
 *   • Every method is typed with strict input/output contracts
 *   • Mirrors the public API of CentralWorkerPool exactly
 *   • Distributed-ready: all IDs are strings (Redis-safe keys)
 */

import type { PoolTask, PoolResult, SchedulerConfig, BackpressureDecision } from "../worker-types.ts";

// ── Core scheduler interface ──────────────────────────────────────────────────

/**
 * IWorkerPool — contract for any governed parallel task executor.
 * CentralWorkerPool satisfies this interface.
 */
export interface IWorkerPool {
  /**
   * Submit a task for governed, priority-scheduled execution.
   * Returns a PoolResult — never throws.
   */
  submit<T>(task: PoolTask<T>): Promise<PoolResult<T>>;

  /**
   * Cancel a queued task by taskId.
   * Returns true if the task was in the queue and removed.
   */
  cancel(taskId: string, runId: string): boolean;

  /**
   * Cancel all queued tasks associated with a pathId.
   */
  cancelPath(pathId: string): void;

  /**
   * Stop accepting new work; wait for active tasks to drain.
   */
  drain(): Promise<void>;

  /** Number of tasks currently executing. */
  readonly activeCount: number;

  /** Number of tasks waiting in the priority queue. */
  readonly pendingCount: number;

  /** Full diagnostic snapshot. */
  stats(): IPoolStats;
}

// ── Stats contract ────────────────────────────────────────────────────────────

export interface IPoolStats {
  active:       number;
  pending:      number;
  draining:     boolean;
  metrics:      IWorkerMetricsSnapshot;
  backpressure: IBackpressureSnapshot;
  limiter:      ILimiterStats;
}

export interface IWorkerMetricsSnapshot {
  enqueued:   number;
  dequeued:   number;
  started:    number;
  completed:  number;
  failed:     number;
  timedOut:   number;
  retried:    number;
  cancelled:  number;
  overflowed: number;
}

export interface IBackpressureSnapshot {
  active:       number;
  queued:       number;
  maxActive:    number;
  maxQueued:    number;
  saturation:   number;
  state:        BackpressureDecision;
}

export interface ILimiterStats {
  globalLimit:   number;
  perRunLimit:   number;
  activeByRun:   Record<string, number>;
}

// ── Backpressure controller interface ────────────────────────────────────────

export interface IBackpressureController {
  configure(cfg: { maxConcurrency: number; maxQueueSize: number; saturationThreshold: number }): void;
  evaluate(active: number, queued: number): BackpressureDecision;
  saturationRatio(): number;
  throttleCooldownMs(): number;
  snapshot(): IBackpressureSnapshot;
}

// ── Execution limiter interface ───────────────────────────────────────────────

export interface IExecutionLimiter {
  configure(cfg: { globalLimit: number; perRunLimit: number }): void;
  hasCapacity(runId: string): boolean;
  acquire(runId: string): () => void;
  stats(): ILimiterStats;
}

// ── Priority queue interface ──────────────────────────────────────────────────

export interface IPriorityQueue<T> {
  enqueue(item: T): void;
  dequeue(): T | undefined;
  peek(): T | undefined;
  remove(id: string): boolean;
  toArray(): T[];
  readonly size: number;
  readonly isEmpty: boolean;
}

// ── Distributed-ready task ID contract ───────────────────────────────────────

/**
 * All task IDs must be globally unique string keys.
 * Follows the format: {type}:{runId}:{uuid}
 * Redis-safe: no special characters beyond colons.
 */
export type DistributedTaskId = `${string}:${string}:${string}`;

/** Constructs a deterministic distributed task ID. */
export function makeDistributedTaskId(
  type:   string,
  runId:  string,
  suffix: string,
): DistributedTaskId {
  return `${type}:${runId}:${suffix}` as DistributedTaskId;
}
