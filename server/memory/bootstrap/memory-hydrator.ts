/**
 * server/memory/bootstrap/memory-hydrator.ts
 *
 * Phase 1 — Memory Hydrator.
 *
 * Injects loaded persisted data into the in-process executor stores.
 * Calls the hydrate() methods exposed by each store — idempotent.
 *
 * Responsibility: transform loaded data → in-process store injection.
 * Does NOT load data (see memory-loader.ts).
 * Does NOT manage the hydration lifecycle (see hydration-manager.ts).
 */

import { executionHistory, failureMemory, learningStore } from '../../agents/executor/index.ts';
import type { ExecutionHistoryEntry, FailurePattern, LearnedEntry } from '../../agents/executor/index.ts';
import type { StoreHydrationResult } from './hydration.types.ts';

// ── Individual hydrators ──────────────────────────────────────────────────────

export function hydrateExecutionHistory(entries: ExecutionHistoryEntry[]): StoreHydrationResult {
  const start = Date.now();
  const errors: string[] = [];
  let restored = 0;
  let skipped  = 0;

  try {
    restored = executionHistory.hydrate(entries);
    skipped  = entries.length - restored;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    store:      'execution-history',
    restored,
    skipped,
    errors,
    durationMs: Date.now() - start,
  };
}

export function hydrateFailureMemory(patterns: FailurePattern[]): StoreHydrationResult {
  const start = Date.now();
  const errors: string[] = [];
  let restored = 0;
  let skipped  = 0;

  try {
    restored = failureMemory.hydrate(patterns);
    skipped  = patterns.length - restored;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    store:      'failure-memory',
    restored,
    skipped,
    errors,
    durationMs: Date.now() - start,
  };
}

export function hydrateLearningStore(entries: LearnedEntry[]): StoreHydrationResult {
  const start = Date.now();
  const errors: string[] = [];
  let restored = 0;
  let skipped  = 0;

  try {
    restored = learningStore.hydrate(entries);
    skipped  = entries.length - restored;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    store:      'learning-store',
    restored,
    skipped,
    errors,
    durationMs: Date.now() - start,
  };
}
