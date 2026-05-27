import { sleep } from '../../../orchestration/utils/execution-utils.ts';

export interface RetryOptions {
  maxAttempts: number;
  delayMs?:    number;
}

export const retryHandler = {
  async withRetry<T>(
    stepId:  string,
    runId:   string,
    fn:      () => Promise<T>,
    opts:    RetryOptions,
  ): Promise<T> {
    const { maxAttempts, delayMs = 500 } = opts;
    let   lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) await sleep(delayMs * attempt);
      }
    }

    throw lastErr;
  },
};
