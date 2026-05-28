/**
 * server/agents/terminal/utils/execution-utils.ts
 *
 * Pure utility helpers for the terminal agent layer.
 * No side effects, no external dependencies.
 */

import { randomUUID } from 'crypto';

/** Generate a short unique ID for steps / checkpoints. */
export function generateId(prefix = 'term'): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/** Elapsed time in ms since a given start timestamp. */
export function elapsedMs(start: number): number {
  return Date.now() - start;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Compute retry delay with optional backoff. */
export function retryDelay(
  attempt:  number,
  baseMs:   number,
  backoff:  'none' | 'linear' | 'exponential',
): number {
  if (backoff === 'exponential') return baseMs * Math.pow(2, attempt - 1);
  if (backoff === 'linear')      return baseMs * attempt;
  return 0;
}

/** Sleep for a given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Classify an error string into a recovery action. */
export function classifyError(error: string): 'retry' | 'skip' | 'abort' {
  if (/timeout|ETIMEDOUT/i.test(error))  return 'skip';
  if (/not found|ENOENT/i.test(error))   return 'skip';
  if (/permission|EACCES/i.test(error))  return 'abort';
  return 'abort';
}

/** Truncate a string to a max length, appending ellipsis if needed. */
export function truncate(s: string, maxLen = 500): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '…';
}

/** Safely extract a string error message from an unknown throw. */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
