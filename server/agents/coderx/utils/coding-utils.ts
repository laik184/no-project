/**
 * server/agents/coderx/utils/coding-utils.ts
 *
 * Pure utility helpers — no execution logic, no side effects.
 */

import { randomUUID } from 'crypto';

// ── ID generation ─────────────────────────────────────────────────────────────

export function generateStepId(): string {
  return `cxstep_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generateSessionId(): string {
  return `cxsess_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generatePlanId(): string {
  return `cxplan_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generatePhaseId(): string {
  return `cxphase_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export function generateTaskId(): string {
  return `cxtask_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
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

// ── Retryability classification ───────────────────────────────────────────────

export function isRetryableError(error: string): boolean {
  const NON_RETRYABLE = [
    /permission denied/i,
    /not found in registry/i,
    /blocked tool/i,
    /validation.*failed/i,
    /missing.*required/i,
    /invalid.*input/i,
    /malformed.*request/i,
  ];
  return !NON_RETRYABLE.some((re) => re.test(error));
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Prompt normalization ──────────────────────────────────────────────────────

export function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ');
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

// ── Safe JSON parse ───────────────────────────────────────────────────────────

export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
