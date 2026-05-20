import type { RetryStrategy, Severity } from '../types.ts';

const QUICK_DELAY_MS = 100;
const DEEP_DELAY_MS = 500;
const FALLBACK_DELAY_MS = 1000;

const DELAY_MAP: Record<RetryStrategy, number> = {
  quick: QUICK_DELAY_MS,
  deep: DEEP_DELAY_MS,
  fallback: FALLBACK_DELAY_MS,
};

export function retryDelayMs(strategy: RetryStrategy): number {
  return DELAY_MAP[strategy];
}

export function shouldRetryOnSeverity(severity: Severity, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false;
  if (severity === 'critical' && attempt >= Math.floor(maxAttempts * 0.5)) return false;
  return true;
}

export function pickRetryStrategy(score: number, attempt: number, maxAttempts: number): RetryStrategy {
  const remaining = maxAttempts - attempt;
  if (remaining <= 1) return 'fallback';
  if (score >= 0.5) return 'quick';
  return 'deep';
}

export function maxAttemptsGuard(attempt: number, maxAttempts: number): boolean {
  return attempt < maxAttempts;
}

export function backoffDelay(attempt: number, baseMs: number): number {
  return Math.min(baseMs * Math.pow(2, attempt - 1), 5000);
}
