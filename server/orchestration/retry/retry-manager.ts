import { computeDelay, isRetryableError, isHardFailure, type BackoffConfig } from './backoff-strategy.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { sleep } from '../utils/execution-utils.ts';

export interface RetryRecord {
  taskId: string;
  runId: string;
  attempts: number;
  lastAttemptAt: Date;
  lastError: string;
  exhausted: boolean;
}

export interface RetryOptions {
  maxAttempts: number;
  backoff?: Partial<BackoffConfig>;
  onRetry?: (attempt: number, delay: number, error: unknown) => void;
}

const retryRecords = new Map<string, RetryRecord>();

export const retryManager = {
  async withRetry<T>(
    taskId: string,
    runId: string,
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const { maxAttempts, backoff, onRetry } = options;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        retryRecords.delete(taskId);
        return result;
      } catch (err) {
        lastError = err;
        const errorMsg = err instanceof Error ? err.message : String(err);

        retryRecords.set(taskId, {
          taskId,
          runId,
          attempts: attempt,
          lastAttemptAt: new Date(),
          lastError: errorMsg,
          exhausted: attempt >= maxAttempts,
        });

        if (isHardFailure(err)) {
          runLogger.log(runId, 'error', `[retry-manager] Hard failure on task ${taskId}: ${errorMsg}`);
          throw err;
        }

        if (!isRetryableError(err) && attempt > 1) {
          runLogger.log(runId, 'warn', `[retry-manager] Non-retryable error on task ${taskId}: ${errorMsg}`);
          throw err;
        }

        if (attempt < maxAttempts) {
          const delay = computeDelay(attempt, backoff);
          runLogger.log(runId, 'warn', `[retry-manager] Retrying task ${taskId} (${attempt}/${maxAttempts}) in ${delay}ms`);
          onRetry?.(attempt, delay, err);
          await sleep(delay);
        }
      }
    }

    runLogger.log(runId, 'error', `[retry-manager] Task ${taskId} exhausted after ${maxAttempts} attempts`);
    throw lastError;
  },

  getRecord(taskId: string): RetryRecord | undefined {
    return retryRecords.get(taskId);
  },

  isExhausted(taskId: string): boolean {
    return retryRecords.get(taskId)?.exhausted ?? false;
  },

  clearRecord(taskId: string): void {
    retryRecords.delete(taskId);
  },

  getAllRecords(): RetryRecord[] {
    return Array.from(retryRecords.values());
  },
};
