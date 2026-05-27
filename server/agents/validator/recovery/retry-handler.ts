export interface RetryOptions {
  maxAttempts: number;
  delayMs?:    number;
  backoff?:    'linear' | 'exponential';
}

export interface RetryResult<T> {
  value:    T;
  attempts: number;
}

export const retryHandler = {
  async withRetry<T>(
    stepId:  string,
    runId:   string,
    fn:      () => Promise<T>,
    opts:    RetryOptions,
  ): Promise<T> {
    const { maxAttempts, delayMs = 500, backoff = 'linear' } = opts;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) {
          const wait = backoff === 'exponential'
            ? delayMs * Math.pow(2, attempt - 1)
            : delayMs * attempt;
          await new Promise(r => setTimeout(r, wait));
        }
      }
    }
    throw lastErr;
  },
};
