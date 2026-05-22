/**
 * Responsibility: Retry policy for failed queued tasks — exponential backoff + jitter.
 *                 Determines if a task should be retried or sent to dead-letter queue.
 * Dependencies: task-queue (QueuedTask type only), dead-letter-queue
 * Failure: exhausted tasks forwarded to dead-letter queue; caller receives "exhausted" decision.
 * Telemetry: callers emit distributed.retry / queue.blocked based on RetryDecision.
 */

import type { QueuedTask }   from "./task-queue.ts";
import { deadLetterQueue }   from "./dead-letter-queue.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RetryDecision = "retry" | "dead_letter" | "drop";

export interface RetryOutcome {
  decision:  RetryDecision;
  delayMs:   number;
  attempts:  number;
  maxAttempts: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_DELAY_MS  = 1_000;
const MAX_DELAY_MS   = 30_000;
const JITTER_RATIO   = 0.2;

// ── Policy ────────────────────────────────────────────────────────────────────

class QueueRetryPolicy {
  /** Evaluate whether a failed task should be retried. */
  evaluate(task: QueuedTask, error: string): RetryOutcome {
    const attempts    = task.attempts;
    const maxAttempts = task.maxAttempts;

    if (attempts >= maxAttempts) {
      deadLetterQueue.push(task, error);
      return { decision: "dead_letter", delayMs: 0, attempts, maxAttempts };
    }

    const exponential = Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
    const jitter      = exponential * JITTER_RATIO * Math.random();
    const delayMs     = Math.round(exponential + jitter);

    return { decision: "retry", delayMs, attempts, maxAttempts };
  }

  /** Apply retry: waits for delayMs then re-enqueues the task. */
  async applyRetry(task: QueuedTask, outcome: RetryOutcome): Promise<boolean> {
    if (outcome.decision !== "retry") return false;

    await new Promise<void>(r => setTimeout(r, outcome.delayMs));

    const { taskQueue } = await import("./task-queue.ts");
    return taskQueue.requeue(task);
  }
}

export const queueRetryPolicy = new QueueRetryPolicy();
