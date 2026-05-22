/**
 * server/quantum/telemetry/queue-telemetry.ts
 *
 * Typed telemetry emitters for queue-level events.
 * Events covered
 * ──────────────
 *   queue.saturated   queue.overflow   execution.rejected   execution.throttled
 */

import { bus }           from "../../infrastructure/events/bus.ts";
import { WORKER_EVENTS } from "../scheduler/worker-events.ts";
import type {
  QueueSaturatedPayload,
  QueueOverflowPayload,
  ExecutionRejectedPayload,
} from "../scheduler/worker-events.ts";

function emit(runId: string, eventType: string, payload: unknown): void {
  bus.emit("agent.event", {
    runId,
    eventType: eventType as any,
    phase:     "worker-queue",
    ts:        Date.now(),
    payload,
  });
}

export function emitQueueSaturated(runId: string, p: QueueSaturatedPayload): void {
  emit(runId, WORKER_EVENTS.QUEUE_SATURATED, p);
}

export function emitQueueOverflow(runId: string, p: QueueOverflowPayload): void {
  emit(runId, WORKER_EVENTS.QUEUE_OVERFLOW, p);
}

export function emitExecutionRejected(runId: string, p: ExecutionRejectedPayload): void {
  emit(runId, WORKER_EVENTS.EXECUTION_REJECTED, p);
}

export function emitExecutionThrottled(
  runId:       string,
  taskId:      string,
  cooldownMs:  number,
  saturation:  number,
): void {
  emit(runId, WORKER_EVENTS.EXECUTION_THROTTLED, {
    taskId, saturation, cooldownMs, ts: Date.now(),
  });
}
