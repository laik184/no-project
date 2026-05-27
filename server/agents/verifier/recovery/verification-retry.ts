import { sleep, retryFixed } from '../../../orchestration/utils/execution-utils.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export interface RetryOptions {
  maxAttempts:  number;
  delayMs:      number;
  backoffFactor?: number;
  label?:       string;
}

export interface RetryResult<T> {
  value:    T;
  attempts: number;
  elapsed:  number;
}

export async function withVerificationRetry<T>(
  runId:  string,
  fn:     () => Promise<T>,
  opts:   RetryOptions,
): Promise<RetryResult<T>> {
  const label   = opts.label ?? 'operation';
  const start   = Date.now();
  let   attempt = 0;
  let   delay   = opts.delayMs;

  while (attempt < opts.maxAttempts) {
    attempt++;
    try {
      verifierLogger.debug(runId, `[retry] ${label} attempt ${attempt}/${opts.maxAttempts}`);
      const value = await fn();
      return { value, attempts: attempt, elapsed: Date.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      verifierLogger.warn(runId, `[retry] ${label} attempt ${attempt} failed: ${message}`);

      if (attempt >= opts.maxAttempts) throw err;

      await sleep(delay);
      if (opts.backoffFactor) delay = Math.floor(delay * opts.backoffFactor);
    }
  }

  throw new Error(`[retry] ${label} exhausted ${opts.maxAttempts} attempts`);
}

export async function withFixedRetry<T>(
  fn:          () => Promise<T>,
  maxAttempts: number,
  delayMs:     number,
): Promise<T> {
  return retryFixed(fn, maxAttempts, delayMs);
}
