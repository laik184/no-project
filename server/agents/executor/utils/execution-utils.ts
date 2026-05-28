/**
 * server/agents/executor/utils/execution-utils.ts
 *
 * Pure utility helpers — no execution logic, no side effects.
 */

import { randomUUID } from 'crypto';

// ── ID generation ─────────────────────────────────────────────────────────────

export function generateStepId(): string {
  return `step_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generateSessionId(): string {
  return `sess_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generatePlanId(): string {
  return `plan_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// ── Timing ────────────────────────────────────────────────────────────────────

export function elapsedMs(from: Date): number {
  return Date.now() - from.getTime();
}

export function now(): Date {
  return new Date();
}

// ── Error normalization ───────────────────────────────────────────────────────

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Retry delay ───────────────────────────────────────────────────────────────

export function computeRetryDelay(
  attempt: number,
  delayMs: number,
  backoff:  'none' | 'linear' | 'exponential',
): number {
  if (backoff === 'exponential') return delayMs * Math.pow(2, attempt - 1);
  if (backoff === 'linear')      return delayMs * attempt;
  return 0;
}

// ── Classification ────────────────────────────────────────────────────────────

export function isRetryableError(error: string): boolean {
  const NON_RETRYABLE = [
    /permission denied/i,
    /not found in registry/i,
    /blocked tool/i,
    /validation.*failed/i,
    /missing.*required/i,
    /invalid.*input/i,
  ];
  return !NON_RETRYABLE.some((re) => re.test(error));
}

// ── Collection helpers ────────────────────────────────────────────────────────

export function groupBy<T>(
  items: T[],
  key:   (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const g = groups.get(k) ?? [];
    g.push(item);
    groups.set(k, g);
  }
  return groups;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
