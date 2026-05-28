/**
 * server/agents/supervisor/utils/supervision-utils.ts
 *
 * Pure utility functions for the supervisor agent orchestration layer.
 * No side effects. No tool calls. No direct execution.
 */

import { randomUUID } from 'crypto';
import type { RecoveryAction, TaskOutcome } from '../types/supervisor.types.ts';

/** Generate a unique supervision run ID. */
export function makeRunId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

/** Milliseconds elapsed since a timestamp. */
export function elapsedMs(since: number): number {
  return Date.now() - since;
}

/** Exponential backoff delay in ms, capped at maxMs. */
export function backoffMs(attempt: number, baseMs = 500, maxMs = 10_000): number {
  return Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
}

/** Sleep for n milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Classify an error string into a recovery action.
 * Pure function — no I/O, no side effects.
 */
export function decideRecovery(error: string): RecoveryAction {
  if (/permission|EACCES|EPERM|unauthorized/i.test(error)) return 'abort';
  if (/timeout|ETIMEDOUT|ESRCH/i.test(error))              return 'skip';
  if (/not found|ENOENT|MODULE_NOT_FOUND/i.test(error))    return 'skip';
  if (/escalat|critical|fatal/i.test(error))               return 'escalate';
  return 'retry';
}

/** Compute the failure rate from a set of outcomes. */
export function failureRate(outcomes: readonly TaskOutcome[]): number {
  if (outcomes.length === 0) return 0;
  return outcomes.filter((o) => !o.success).length / outcomes.length;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Truncate a string to maxLen, appending '…' if cut. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/** Build a safe single-line label (no newlines, max 120 chars). */
export function safeLabel(label: string): string {
  return truncate(label.replace(/[\r\n]+/g, ' '), 120);
}
