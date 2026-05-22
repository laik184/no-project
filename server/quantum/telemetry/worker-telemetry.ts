/**
 * server/quantum/telemetry/worker-telemetry.ts
 *
 * Typed telemetry emitters for all worker lifecycle events.
 * All events flow through the shared EventBus as `agent.event` envelopes
 * and are captured by server/telemetry/telemetry-collector.ts.
 *
 * Events covered
 * ──────────────
 *   worker.created  worker.assigned  worker.started  worker.completed
 *   worker.failed   worker.timeout   worker.retry    worker.cancelled
 *   worker.overloaded
 */

import { bus }           from "../../infrastructure/events/bus.ts";
import { WORKER_EVENTS } from "../scheduler/worker-events.ts";
import type {
  WorkerCreatedPayload,
  WorkerAssignedPayload,
  WorkerStartedPayload,
  WorkerCompletedPayload,
  WorkerFailedPayload,
  WorkerTimeoutPayload,
  WorkerRetryPayload,
  WorkerCancelledPayload,
  WorkerOverloadedPayload,
} from "../scheduler/worker-events.ts";

// ── Private emit helper ───────────────────────────────────────────────────────

function emit(runId: string, eventType: string, payload: unknown): void {
  bus.emit("agent.event", {
    runId,
    eventType: eventType as any,
    phase:     "worker-pool",
    ts:        Date.now(),
    payload,
  });
}

// ── Worker lifecycle emitters ─────────────────────────────────────────────────

export function emitWorkerCreated(runId: string, p: WorkerCreatedPayload): void {
  emit(runId, WORKER_EVENTS.CREATED, p);
}

export function emitWorkerAssigned(runId: string, p: WorkerAssignedPayload): void {
  emit(runId, WORKER_EVENTS.ASSIGNED, p);
}

export function emitWorkerStarted(runId: string, p: WorkerStartedPayload): void {
  emit(runId, WORKER_EVENTS.STARTED, p);
}

export function emitWorkerCompleted(runId: string, p: WorkerCompletedPayload): void {
  emit(runId, WORKER_EVENTS.COMPLETED, p);
}

export function emitWorkerFailed(runId: string, p: WorkerFailedPayload): void {
  emit(runId, WORKER_EVENTS.FAILED, p);
}

export function emitWorkerTimeout(runId: string, p: WorkerTimeoutPayload): void {
  emit(runId, WORKER_EVENTS.TIMEOUT, p);
}

export function emitWorkerRetry(runId: string, p: WorkerRetryPayload): void {
  emit(runId, WORKER_EVENTS.RETRY, p);
}

export function emitWorkerCancelled(runId: string, p: WorkerCancelledPayload): void {
  emit(runId, WORKER_EVENTS.CANCELLED, p);
}

export function emitWorkerOverloaded(runId: string, p: WorkerOverloadedPayload): void {
  emit(runId, WORKER_EVENTS.OVERLOADED, p);
}
