/**
 * Responsibility: BullMQ Worker that consumes jobs from the distributed queue.
 *                 Routes each job to the central worker pool for governed execution.
 * Dependencies: bullmq, queue-factory, queue-telemetry, redis-config
 * Failure: jobs that throw are retried per BullMQ retry policy; exhausted → dead-letter.
 * Telemetry: delegates all events to distributed-queue-telemetry.
 */

import { Worker, type Job }              from "bullmq";
import { getConnection }                 from "./queue-factory.ts";
import { distributedQueueTelemetry }     from "./queue-telemetry.ts";
import { isRedisAvailable }              from "../redis/index.ts";
import type { DistributedJobData, DistributedJobResult } from "./types/index.ts";

const QUEUE_NAME        = "nura:tasks";
const CONCURRENCY       = parseInt(process.env.QUEUE_WORKER_CONCURRENCY ?? "10", 10);

type JobProcessor = (data: DistributedJobData) => Promise<unknown>;

let workerInstance: Worker | null = null;

export function startQueueWorker(processor: JobProcessor): Worker | null {
  if (!isRedisAvailable()) {
    console.warn("[queue-worker] Redis unavailable — BullMQ worker not started.");
    return null;
  }
  if (workerInstance) return workerInstance;

  workerInstance = new Worker<DistributedJobData>(
    QUEUE_NAME,
    async (job: Job<DistributedJobData>) => {
      const { taskId, runId } = job.data;
      distributedQueueTelemetry.onDequeued(taskId, runId, job.data.priority);

      const t0 = Date.now();
      try {
        const output = await processor(job.data);
        const durationMs = Date.now() - t0;
        distributedQueueTelemetry.onCompleted(taskId, runId, durationMs);
        return { taskId, success: true, output, durationMs, attempts: job.attemptsMade, workerId: "bullmq" } satisfies DistributedJobResult;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        distributedQueueTelemetry.onFailed(taskId, runId, error);
        throw err; // BullMQ handles retry
      }
    },
    { connection: getConnection(), concurrency: CONCURRENCY },
  );

  workerInstance.on("failed",  (job, err) => {
    if (!job) return;
    const { taskId, runId } = job.data;
    if (job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      distributedQueueTelemetry.onDeadLetter(taskId, runId, err.message);
    } else {
      distributedQueueTelemetry.onRetried(taskId, runId, job.attemptsMade);
    }
  });
  workerInstance.on("stalled", (jobId) => distributedQueueTelemetry.onStalled(jobId, "unknown"));
  workerInstance.on("error",   (err) => console.error("[queue-worker] Worker error:", err.message));

  console.log(`[queue-worker] BullMQ worker started — queue="${QUEUE_NAME}" concurrency=${CONCURRENCY}`);
  return workerInstance;
}

export async function stopQueueWorker(): Promise<void> {
  if (workerInstance) { await workerInstance.close(); workerInstance = null; }
}
