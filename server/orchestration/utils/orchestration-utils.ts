/**
 * server/orchestration/utils/orchestration-utils.ts
 *
 * Pure utility functions for the orchestration layer.
 * No side effects, no imports from other orchestration modules.
 */

import { randomUUID } from 'crypto';
import type { OrchestrationRetryConfig, DecisionOutcome, OrchestrationFailure } from '../types/orchestration.types.ts';

// ── ID generation ─────────────────────────────────────────────────────────────

export function newOrchestrationId(): string {
  return `orch_${randomUUID()}`;
}

export function newSessionId(): string {
  return `sess_${randomUUID()}`;
}

export function newWorkflowId(): string {
  return `wf_${randomUUID()}`;
}

export function newPhaseId(): string {
  return `ph_${randomUUID()}`;
}

export function newPlanId(): string {
  return `plan_${randomUUID()}`;
}

// ── Timing ────────────────────────────────────────────────────────────────────

export function elapsed(startedAt: Date): number {
  return Date.now() - startedAt.getTime();
}

export function now(): Date {
  return new Date();
}

// ── Retry delay calculation ───────────────────────────────────────────────────

export function computeRetryDelay(
  attempt: number,
  config:  OrchestrationRetryConfig,
): number {
  if (config.backoff === 'exponential') {
    return config.delayMs * Math.pow(2, attempt - 1);
  }
  if (config.backoff === 'linear') {
    return config.delayMs * attempt;
  }
  return 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Error extraction ──────────────────────────────────────────────────────────

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

// ── Decision logic ────────────────────────────────────────────────────────────

export function shouldEscalate(
  failures: OrchestrationFailure[],
  runId:    string,
  maxConsecutive: number = 3,
): boolean {
  const runFailures = failures
    .filter(f => f.runId === runId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (runFailures.length < maxConsecutive) return false;

  const recent = runFailures.slice(0, maxConsecutive);
  return recent.every(f => f.retryCount >= 1);
}

export function decideOnFailure(
  retryCount:  number,
  maxRetries:  number,
  optional:    boolean,
): DecisionOutcome {
  if (optional) return 'skip';
  if (retryCount < maxRetries) return 'retry';
  return 'abort';
}

// ── Progress calculation ──────────────────────────────────────────────────────

export function progressPct(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

// ── Stuck detection ───────────────────────────────────────────────────────────

export function isStuck(startedAt: Date, thresholdMs: number = 120_000): boolean {
  return elapsed(startedAt) > thresholdMs;
}
