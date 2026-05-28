/**
 * server/agents/terminal/utils/execution-utils.ts
 *
 * Pure utility functions for the terminal agent orchestration layer.
 * No side effects, no tool calls, no direct execution.
 */

import { randomUUID } from 'crypto';
import type { RecoveryAction, StepOutcome } from '../types/terminal.types.ts';

/** Generate a short correlation ID. */
export function makeRunId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

/** Milliseconds elapsed since a Date. */
export function elapsedMs(since: Date): number {
  return Date.now() - since.getTime();
}

/** Exponential backoff delay in ms. */
export function backoffMs(attempt: number, baseMs = 500, maxMs = 8_000): number {
  return Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
}

/** Sleep for n milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Decide recovery action from an error message. */
export function decideRecovery(error: string): RecoveryAction {
  if (/timeout|ETIMEDOUT|ESRCH/i.test(error))     return 'skip';
  if (/not found|ENOENT|MODULE_NOT_FOUND/i.test(error)) return 'skip';
  if (/permission|EACCES|EPERM/i.test(error))     return 'abort';
  return 'retry';
}

/** Compute failure rate from outcomes. */
export function failureRate(outcomes: readonly StepOutcome[]): number {
  if (outcomes.length === 0) return 0;
  return outcomes.filter((o) => !o.success).length / outcomes.length;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Truncate a string to maxLen, adding '…' if cut. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/** Build a safe label string (no newlines, max 120 chars). */
export function safeLabel(label: string): string {
  return truncate(label.replace(/[\r\n]+/g, ' '), 120);
}
