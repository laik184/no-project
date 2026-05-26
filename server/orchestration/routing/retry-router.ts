import type { TaskPayload } from '../events/event-types.ts';
import { taskQueue } from '../queue/task-queue.ts';
import { computeDelay, isHardFailure } from '../retry/backoff-strategy.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { sleep } from '../utils/execution-utils.ts';

const MAX_RETRIES = 5;
const retryCounts = new Map<string, number>();
const cooldowns = new Set<string>();

export interface RetryDecision {
  shouldRetry: boolean;
  attempt: number;
  delayMs: number;
  reason: string;
}

export const retryRouter = {
  decide(task: TaskPayload, error: unknown): RetryDecision {
    const count = (retryCounts.get(task.taskId) ?? 0) + 1;

    if (isHardFailure(error)) {
      return {
        shouldRetry: false,
        attempt: count,
        delayMs: 0,
        reason: 'Hard failure — non-retryable error type',
      };
    }

    if (count > MAX_RETRIES) {
      return {
        shouldRetry: false,
        attempt: count,
        delayMs: 0,
        reason: `Max retries (${MAX_RETRIES}) exhausted`,
      };
    }

    if (cooldowns.has(task.taskId)) {
      return {
        shouldRetry: false,
        attempt: count,
        delayMs: 0,
        reason: 'Task is in cooldown period',
      };
    }

    const delayMs = computeDelay(count, { jitter: true });
    return { shouldRetry: true, attempt: count, delayMs, reason: `Retryable error — attempt ${count}/${MAX_RETRIES}` };
  },

  async scheduleRetry(task: TaskPayload, error: unknown): Promise<boolean> {
    const decision = this.decide(task, error);

    if (!decision.shouldRetry) {
      runLogger.log(task.runId, 'warn', `[retry-router] Not retrying task ${task.taskId}: ${decision.reason}`);
      return false;
    }

    retryCounts.set(task.taskId, decision.attempt);
    runLogger.log(task.runId, 'info', `[retry-router] Scheduling retry for ${task.taskId} in ${decision.delayMs}ms (${decision.reason})`);

    await sleep(decision.delayMs);

    const retried: TaskPayload = { ...task, retryCount: decision.attempt };
    taskQueue.enqueue(retried);

    return true;
  },

  setCooldown(taskId: string, durationMs: number): void {
    cooldowns.add(taskId);
    setTimeout(() => cooldowns.delete(taskId), durationMs);
  },

  getRetryCount(taskId: string): number {
    return retryCounts.get(taskId) ?? 0;
  },

  clearRetryState(taskId: string): void {
    retryCounts.delete(taskId);
    cooldowns.delete(taskId);
  },

  isExhausted(taskId: string): boolean {
    return (retryCounts.get(taskId) ?? 0) >= MAX_RETRIES;
  },

  getMaxRetries(): number {
    return MAX_RETRIES;
  },
};
