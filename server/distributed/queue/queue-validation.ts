/**
 * Responsibility: Validates distributed job data before enqueue — fail-closed gate.
 * Dependencies: none
 * Failure: returns error string on failure; never throws.
 * Telemetry: none — pure validation.
 */

import type { DistributedJobData } from "./types/index.ts";

const VALID_WORKER_TYPES = new Set(["io-bound", "cpu-bound", "llm"]);
const VALID_PRIORITIES   = new Set(["critical", "high", "normal", "low", "background"]);
const MAX_TIMEOUT_MS     = 600_000;
const MIN_TIMEOUT_MS     = 100;

class QueueValidation {
  validateJob(data: DistributedJobData): string | null {
    if (!data.taskId?.trim())   return "taskId is required";
    if (!data.runId?.trim())    return "runId is required";
    if (typeof data.projectId !== "number" || data.projectId < 0) return "projectId must be a non-negative number";
    if (!VALID_WORKER_TYPES.has(data.workerType)) return `workerType must be one of: ${[...VALID_WORKER_TYPES].join(", ")}`;
    if (!VALID_PRIORITIES.has(data.priority))     return `priority must be one of: ${[...VALID_PRIORITIES].join(", ")}`;
    if (data.timeoutMs < MIN_TIMEOUT_MS)          return `timeoutMs must be >= ${MIN_TIMEOUT_MS}`;
    if (data.timeoutMs > MAX_TIMEOUT_MS)          return `timeoutMs must be <= ${MAX_TIMEOUT_MS}`;
    if (data.payload === undefined)               return "payload is required";
    return null;
  }

  validateBatch(jobs: DistributedJobData[]): Map<string, string> {
    const errors = new Map<string, string>();
    for (const job of jobs) {
      const err = this.validateJob(job);
      if (err) errors.set(job.taskId ?? "unknown", err);
    }
    return errors;
  }
}

export const queueValidation = new QueueValidation();
