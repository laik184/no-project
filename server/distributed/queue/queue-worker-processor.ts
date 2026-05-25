/**
 * Responsibility: BullMQ job processor registry — routes distributed jobs to
 *                 type-registered handlers via the CentralWorkerPool.
 *                 Replaces the no-op passthrough in the bootstrap phase.
 * Dependencies: central-worker-pool
 * Failure: throws on handler failure so BullMQ can retry per its retry policy;
 *          returns a skip result when no handler is registered (avoids retry loops).
 * Telemetry: delegates to CentralWorkerPool per-task telemetry.
 */

import { centralWorkerPool } from "../workers/central-worker-pool.ts";
import type { DistributedJobData } from "./types/index.ts";

// ── Handler registry ─────────────────────────────────────────────────────────

type JobHandler = (payload: unknown, data: DistributedJobData) => Promise<unknown>;

const handlers = new Map<string, JobHandler>();

/**
 * Register a processor for a specific job `workerType`.
 * Must be called before jobs of that type are dequeued.
 * Registering the same type again overwrites the previous handler.
 */
export function registerJobHandler(workerType: string, handler: JobHandler): void {
  handlers.set(workerType, handler);
  console.log(`[queue-worker-processor] Handler registered for workerType="${workerType}"`);
}

/**
 * The real BullMQ job processor.
 * Routes the job to a registered handler via CentralWorkerPool for governed,
 * backpressure-aware, telemetried execution.
 *
 * Throws on execution failure → BullMQ retries per job retry policy.
 * Returns a skip result when no handler is registered → job completes without retry.
 */
export async function processDistributedJob(data: DistributedJobData): Promise<unknown> {
  const handler =
    handlers.get(data.workerType) ??
    handlers.get("default");

  if (!handler) {
    console.warn(
      `[queue-worker-processor] No handler for workerType="${data.workerType}"` +
      ` taskId=${data.taskId} — completing without processing.`,
    );
    return { skipped: true, reason: "no_handler_registered", taskId: data.taskId };
  }

  const result = await centralWorkerPool.submit({
    taskId:    data.taskId,
    runId:     data.runId,
    projectId: data.projectId,
    type:      "io-bound",
    priority:  data.priority,
    timeoutMs: data.timeoutMs,
    fn:        () => handler(data.payload, data),
  });

  if (!result.success) {
    throw new Error(
      result.error ?? `Worker execution failed for taskId=${data.taskId}`,
    );
  }

  return result.data;
}
