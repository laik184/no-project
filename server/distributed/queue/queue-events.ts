/**
 * Responsibility: BullMQ QueueEvents listener — bridges BullMQ job events
 *                 to the internal bus and distributed queue telemetry.
 * Dependencies: bullmq, queue-factory, queue-telemetry
 * Failure: event errors are logged; never rethrows.
 * Telemetry: all BullMQ lifecycle events forwarded to distributedQueueTelemetry.
 */

import { QueueEvents }               from "bullmq";
import { getConnection }             from "./queue-factory.ts";
import { distributedQueueTelemetry } from "./queue-telemetry.ts";
import { isRedisAvailable }          from "../redis/index.ts";

const QUEUE_NAME = "nura:tasks";

let eventsInstance: QueueEvents | null = null;

export function startQueueEvents(): QueueEvents | null {
  if (!isRedisAvailable()) return null;
  if (eventsInstance) return eventsInstance;

  eventsInstance = new QueueEvents(QUEUE_NAME, { connection: getConnection() });

  eventsInstance.on("completed", ({ jobId }) =>
    distributedQueueTelemetry.onCompleted(jobId, "system", 0));

  eventsInstance.on("failed", ({ jobId, failedReason }) =>
    distributedQueueTelemetry.onFailed(jobId, "system", failedReason));

  eventsInstance.on("stalled", ({ jobId }) =>
    distributedQueueTelemetry.onStalled(jobId, "system"));

  eventsInstance.on("drained", () =>
    distributedQueueTelemetry.onDrained(QUEUE_NAME));

  eventsInstance.on("error", (err) =>
    console.error("[queue-events] QueueEvents error:", err.message));

  console.log(`[queue-events] QueueEvents listener started for "${QUEUE_NAME}"`);
  return eventsInstance;
}

export async function stopQueueEvents(): Promise<void> {
  if (eventsInstance) { await eventsInstance.close(); eventsInstance = null; }
}
