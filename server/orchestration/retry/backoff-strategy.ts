export interface BackoffConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitter: boolean;
}

const DEFAULT_CONFIG: BackoffConfig = {
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  multiplier: 2,
  jitter: true,
};

/**
 * Compute the delay for a given retry attempt using exponential backoff.
 * attempt is 1-indexed.
 */
export function computeDelay(attempt: number, config: Partial<BackoffConfig> = {}): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const exponential = cfg.baseDelayMs * Math.pow(cfg.multiplier, attempt - 1);
  const capped = Math.min(exponential, cfg.maxDelayMs);
  if (!cfg.jitter) return capped;
  // Full jitter: random value in [0, capped]
  return Math.floor(Math.random() * capped);
}

/**
 * Compute a list of delays for a given number of attempts.
 */
export function computeDelaySequence(maxAttempts: number, config: Partial<BackoffConfig> = {}): number[] {
  return Array.from({ length: maxAttempts }, (_, i) => computeDelay(i + 1, config));
}

/**
 * Determine if an error is worth retrying based on its message.
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('socket') ||
    msg.includes('enotfound') ||
    msg.includes('rate limit') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('429')
  );
}

/**
 * Determine if an error is a hard (non-retryable) failure.
 */
export function isHardFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('not found') ||
    msg.includes('invalid') ||
    msg.includes('400') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('404')
  );
}

export const defaultBackoffConfig: BackoffConfig = DEFAULT_CONFIG;
