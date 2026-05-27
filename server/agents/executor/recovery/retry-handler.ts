import {
  retryManager,
  type RetryOptions,
} from '../../../orchestration/retry/retry-manager.ts';
import { executorLogger } from '../telemetry/executor-logger.ts';
import { executorMetrics } from '../telemetry/executor-metrics.ts';

export interface ExecutorRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

export const retryHandler = {
  async withRetry<T>(
    taskId:    string,
    runId:     string,
    fn:        () => Promise<T>,
    opts:      ExecutorRetryOptions = {},
  ): Promise<T> {
    const options: RetryOptions = {
      maxAttempts: opts.maxAttempts ?? 3,
      backoff: {
        baseDelayMs: opts.baseDelayMs ?? 500,
        maxDelayMs:  10_000,
        jitter:      true,
      },
      onRetry: (attempt, delay) => {
        executorLogger.warn(runId, `Retry ${attempt} for task ${taskId} in ${delay}ms`);
        executorMetrics.recordRetry(runId);
      },
    };

    return retryManager.withRetry(taskId, runId, fn, options);
  },
};
