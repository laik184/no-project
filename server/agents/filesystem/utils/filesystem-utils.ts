/**
 * server/agents/filesystem/utils/filesystem-utils.ts
 *
 * Pure utility helpers — no fs access, no side effects.
 */

import { randomUUID } from 'crypto';

// ── ID generation ─────────────────────────────────────────────────────────────

export function generateOperationId(): string {
  return `fsop_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function generateSessionId(): string {
  return `fss_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

// ── Timing ────────────────────────────────────────────────────────────────────

export function elapsedMs(from: Date): number {
  return Date.now() - from.getTime();
}

export function now(): Date {
  return new Date();
}

// ── Path helpers (string-only — no fs resolution) ─────────────────────────────

export function normalizeSeparators(p: string): string {
  return p.replace(/\\/g, '/');
}

export function stripLeadingSlash(p: string): string {
  return p.replace(/^\/+/, '');
}

export function stripTrailingSlash(p: string): string {
  return p.replace(/\/+$/, '');
}

export function joinPaths(...parts: string[]): string {
  return parts
    .map((p, i) => (i === 0 ? stripTrailingSlash(p) : stripLeadingSlash(stripTrailingSlash(p))))
    .filter(Boolean)
    .join('/');
}

export function extensionOf(p: string): string {
  const dot = p.lastIndexOf('.');
  return dot !== -1 ? p.slice(dot) : '';
}

export function basenameOf(p: string): string {
  return normalizeSeparators(p).split('/').pop() ?? p;
}

// ── Retry delay ───────────────────────────────────────────────────────────────

export function computeDelay(
  attempt:  number,
  delayMs:  number,
  backoff:  'none' | 'linear' | 'exponential',
): number {
  if (backoff === 'exponential') return delayMs * Math.pow(2, attempt - 1);
  if (backoff === 'linear')      return delayMs * attempt;
  return 0;
}

// ── Error normalization ───────────────────────────────────────────────────────

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Result helpers ────────────────────────────────────────────────────────────

export function isRetryableCode(code: string): boolean {
  return code === 'TIMEOUT' || code === 'EXECUTION_ERROR';
}
