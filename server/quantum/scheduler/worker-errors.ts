/**
 * server/quantum/scheduler/worker-errors.ts
 *
 * Named, typed error classes for the Worker Pool system.
 * Each carries a machine-readable `code` for telemetry classification.
 */

export type WorkerErrorCode =
  | "POOL_EXHAUSTED"
  | "QUEUE_OVERFLOW"
  | "TASK_TIMEOUT"
  | "TASK_CANCELLED"
  | "BACKPRESSURE_REJECTED"
  | "PER_RUN_LIMIT"
  | "WORKER_FAILED";

export class WorkerPoolError extends Error {
  readonly code: WorkerErrorCode;

  constructor(code: WorkerErrorCode, message: string) {
    super(message);
    this.name = "WorkerPoolError";
    this.code = code;
  }
}

/** No worker slots available and pool is at hard limit. */
export class PoolExhaustedError extends WorkerPoolError {
  constructor(active: number, limit: number) {
    super("POOL_EXHAUSTED", `Pool exhausted: ${active}/${limit} slots active`);
    this.name = "PoolExhaustedError";
  }
}

/** Task queue has reached its maximum size. */
export class QueueOverflowError extends WorkerPoolError {
  constructor(queueSize: number, maxSize: number) {
    super("QUEUE_OVERFLOW", `Queue overflow: ${queueSize}/${maxSize} items`);
    this.name = "QueueOverflowError";
  }
}

/** Task did not complete within its allotted timeout. */
export class TaskTimeoutError extends WorkerPoolError {
  readonly taskId: string;
  readonly timeoutMs: number;

  constructor(taskId: string, timeoutMs: number) {
    super("TASK_TIMEOUT", `Task "${taskId}" timed out after ${timeoutMs}ms`);
    this.name    = "TaskTimeoutError";
    this.taskId  = taskId;
    this.timeoutMs = timeoutMs;
  }
}

/** Task was cancelled via AbortSignal before or during execution. */
export class TaskCancelledError extends WorkerPoolError {
  readonly taskId: string;

  constructor(taskId: string) {
    super("TASK_CANCELLED", `Task "${taskId}" was cancelled`);
    this.name   = "TaskCancelledError";
    this.taskId = taskId;
  }
}

/** Task rejected due to active backpressure (saturation above threshold). */
export class BackpressureError extends WorkerPoolError {
  readonly saturationRatio: number;

  constructor(ratio: number) {
    super("BACKPRESSURE_REJECTED", `Backpressure: saturation ${(ratio * 100).toFixed(1)}% exceeds threshold`);
    this.name             = "BackpressureError";
    this.saturationRatio  = ratio;
  }
}

/** Task rejected because the submitting run has hit its per-run concurrency limit. */
export class PerRunLimitError extends WorkerPoolError {
  readonly runId:       string;
  readonly activeCount: number;
  readonly limit:       number;

  constructor(runId: string, active: number, limit: number) {
    super("PER_RUN_LIMIT", `Run "${runId}" at concurrency limit: ${active}/${limit}`);
    this.name        = "PerRunLimitError";
    this.runId       = runId;
    this.activeCount = active;
    this.limit       = limit;
  }
}

/** Classify an unknown thrown value into a WorkerErrorCode. */
export function classifyError(err: unknown): WorkerErrorCode {
  if (err instanceof WorkerPoolError) return err.code;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("timeout") || msg.includes("timed out")) return "TASK_TIMEOUT";
  if (msg.includes("cancel") || msg.includes("aborted"))    return "TASK_CANCELLED";
  return "WORKER_FAILED";
}
