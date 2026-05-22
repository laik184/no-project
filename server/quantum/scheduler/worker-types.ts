/**
 * server/quantum/scheduler/worker-types.ts
 *
 * Canonical type contracts for the centralized Worker Pool + Priority Scheduler.
 * Single source of truth — no imports to prevent circular dependencies.
 */

// ── Priority levels ────────────────────────────────────────────────────────────

/** Lower numeric value = higher urgency. Heap-ordered. */
export enum TaskPriority {
  CRITICAL = 0,
  HIGH     = 1,
  NORMAL   = 2,
  LOW      = 3,
}

// ── Execution modes ───────────────────────────────────────────────────────────

export type TaskExecutionMode = "parallel" | "serial" | "exclusive";
export type PoolWorkerType    = "io-bound" | "cpu-bound" | "llm" | "agent";

// ── Pool task ─────────────────────────────────────────────────────────────────

export interface PoolTask<T = unknown> {
  readonly id:            string;
  readonly runId:         string;
  readonly priority:      TaskPriority;
  readonly timeoutMs:     number;
  readonly maxRetries:    number;
  readonly taskType:      string;         // e.g. "tool-call", "dag-node", "llm-call"
  readonly executionMode: TaskExecutionMode;
  readonly fn:            () => Promise<T>;
  readonly signal?:       AbortSignal;
  readonly metadata?:     Record<string, unknown>;
}

// ── Pool result ───────────────────────────────────────────────────────────────

export interface PoolResult<T = unknown> {
  readonly taskId:     string;
  readonly runId:      string;
  readonly success:    boolean;
  readonly data?:      T;
  readonly error?:     string;
  readonly durationMs: number;
  readonly retryCount: number;
  readonly workerId:   string;
}

// ── Scheduler configuration ───────────────────────────────────────────────────

export interface SchedulerConfig {
  maxConcurrency:      number;   // hard cap on simultaneous running tasks
  maxQueueSize:        number;   // max pending tasks before overflow
  defaultTimeoutMs:    number;
  saturationThreshold: number;   // 0–1 fraction of maxConcurrency at which backpressure kicks in
  maxRetriesDefault:   number;
  perRunLimit:         number;   // max concurrent tasks per runId
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  maxConcurrency:      20,
  maxQueueSize:        200,
  defaultTimeoutMs:    60_000,
  saturationThreshold: 0.8,
  maxRetriesDefault:   2,
  perRunLimit:         8,
};

// ── Queue / pool metrics ──────────────────────────────────────────────────────

export interface QueueMetrics {
  size:          number;
  peakSize:      number;
  totalEnqueued: number;
  totalDequeued: number;
  overflows:     number;
}

export interface PoolMetricsSnapshot {
  active:          number;
  queued:          number;
  completed:       number;
  failed:          number;
  timedOut:        number;
  retried:         number;
  cancelled:       number;
  saturationRatio: number;  // active / maxConcurrency
  queueMetrics:    QueueMetrics;
}

// ── Backpressure decision ─────────────────────────────────────────────────────

export type BackpressureDecision = "accept" | "throttle" | "reject";
