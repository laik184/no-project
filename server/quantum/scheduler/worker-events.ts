/**
 * server/quantum/scheduler/worker-events.ts
 *
 * Event name constants and typed payload interfaces for the Worker Pool system.
 * All events flow through the shared EventBus as `agent.event` envelopes.
 */

// ── Event name constants ──────────────────────────────────────────────────────

export const WORKER_EVENTS = {
  CREATED:     "worker.created",
  ASSIGNED:    "worker.assigned",
  STARTED:     "worker.started",
  COMPLETED:   "worker.completed",
  FAILED:      "worker.failed",
  TIMEOUT:     "worker.timeout",
  RETRY:       "worker.retry",
  CANCELLED:   "worker.cancelled",
  OVERLOADED:  "worker.overloaded",

  QUEUE_SATURATED:    "queue.saturated",
  QUEUE_OVERFLOW:     "queue.overflow",
  EXECUTION_REJECTED: "execution.rejected",
  EXECUTION_THROTTLED: "execution.throttled",
} as const;

export type WorkerEventName = typeof WORKER_EVENTS[keyof typeof WORKER_EVENTS];

// ── Event payload interfaces ──────────────────────────────────────────────────

export interface WorkerCreatedPayload {
  workerId:   string;
  workerType: string;
  poolSize:   number;
}

export interface WorkerAssignedPayload {
  workerId: string;
  taskId:   string;
  runId:    string;
  priority: number;
  taskType: string;
}

export interface WorkerStartedPayload {
  workerId:  string;
  taskId:    string;
  runId:     string;
  startedAt: number;
}

export interface WorkerCompletedPayload {
  workerId:   string;
  taskId:     string;
  runId:      string;
  durationMs: number;
  retryCount: number;
}

export interface WorkerFailedPayload {
  workerId:   string;
  taskId:     string;
  runId:      string;
  error:      string;
  errorCode:  string;
  durationMs: number;
}

export interface WorkerTimeoutPayload {
  workerId:  string;
  taskId:    string;
  runId:     string;
  timeoutMs: number;
}

export interface WorkerRetryPayload {
  taskId:    string;
  runId:     string;
  attempt:   number;
  maxRetries: number;
  delayMs:   number;
}

export interface WorkerCancelledPayload {
  taskId: string;
  runId:  string;
}

export interface WorkerOverloadedPayload {
  active:   number;
  capacity: number;
  ratio:    number;
}

export interface QueueSaturatedPayload {
  queueSize:           number;
  maxSize:             number;
  saturationRatio:     number;
  decision:            string;
}

export interface QueueOverflowPayload {
  taskId:    string;
  runId:     string;
  queueSize: number;
  maxSize:   number;
  evicted?:  number;
}

export interface ExecutionRejectedPayload {
  taskId:  string;
  runId:   string;
  reason:  string;
  code:    string;
}
