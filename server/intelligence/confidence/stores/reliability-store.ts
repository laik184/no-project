/**
 * reliability-store.ts
 *
 * Append-only historical store for per-agent reliability entries.
 * Supports EWMA reliability score computation.
 * Keyed by agentId → ordered array of ReliabilityEntry.
 */

import type { ReliabilityEntry } from "../confidence-types.ts";
import {
  RELIABILITY,
  STORAGE,
} from "../confidence-thresholds.ts";

// ── Store ─────────────────────────────────────────────────────────────────────

const _history = new Map<string, ReliabilityEntry[]>();

// ── Writers ───────────────────────────────────────────────────────────────────

export function appendReliabilityEntry(entry: ReliabilityEntry): void {
  const existing = _history.get(entry.agentId) ?? [];
  existing.push(entry);

  // Enforce per-agent history cap
  if (existing.length > STORAGE.MAX_HISTORY_ENTRIES_PER_AGENT) {
    existing.splice(0, existing.length - STORAGE.MAX_HISTORY_ENTRIES_PER_AGENT);
  }

  _history.set(entry.agentId, existing);
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getHistory(agentId: string): ReliabilityEntry[] {
  return _history.get(agentId) ?? [];
}

export function getRecentHistory(agentId: string, n: number): ReliabilityEntry[] {
  const all = _history.get(agentId) ?? [];
  return all.slice(-n);
}

/**
 * Compute EWMA reliability score (0–1) for an agent.
 * Falls back to raw average when fewer than MIN_SAMPLES_FOR_EWMA entries exist.
 * Returns INITIAL_SCORE for agents with no history.
 */
export function computeReliabilityScore(agentId: string): number {
  const entries = _history.get(agentId) ?? [];

  if (entries.length === 0) {
    return RELIABILITY.INITIAL_SCORE;
  }

  if (entries.length < RELIABILITY.MIN_SAMPLES_FOR_EWMA) {
    const successes = entries.filter(e => e.success).length;
    return successes / entries.length;
  }

  // EWMA — most recent entry gets highest weight
  let ewma = entries[0].success ? 1.0 : 0.0;
  const alpha = RELIABILITY.EWMA_ALPHA;

  for (let i = 1; i < entries.length; i++) {
    const sample = entries[i].success ? 1.0 : 0.0;
    ewma = alpha * sample + (1 - alpha) * ewma;
  }

  return Math.max(0, Math.min(1, ewma));
}

export function getSuccessRate(agentId: string): number {
  const entries = _history.get(agentId);
  if (!entries || entries.length === 0) return RELIABILITY.INITIAL_SCORE;
  const successes = entries.filter(e => e.success).length;
  return successes / entries.length;
}

export function getFailureRate(agentId: string): number {
  return 1 - getSuccessRate(agentId);
}

export function getAverageRetries(agentId: string): number {
  const entries = _history.get(agentId);
  if (!entries || entries.length === 0) return 0;
  return entries.reduce((sum, e) => sum + e.retries, 0) / entries.length;
}

export function getVerificationSuccessRate(agentId: string): number {
  const entries = _history.get(agentId);
  if (!entries || entries.length === 0) return RELIABILITY.INITIAL_SCORE;
  const passed = entries.filter(e => e.verificationPassed).length;
  return passed / entries.length;
}

export function getHallucinationRate(agentId: string): number {
  const entries = _history.get(agentId);
  if (!entries || entries.length === 0) return 0;
  return entries.reduce((sum, e) => sum + e.hallucinationRisk, 0) / entries.length;
}

export function getTotalRuns(agentId: string): number {
  return (_history.get(agentId) ?? []).length;
}

export function getAllAgentIds(): string[] {
  return Array.from(_history.keys());
}

export function clearAgentHistory(agentId: string): void {
  _history.delete(agentId);
}

export function clearAll(): void {
  _history.clear();
}

/**
 * Export a snapshot of all agent reliability summaries.
 */
export function exportSummaries(): Record<string, {
  totalRuns: number;
  successRate: number;
  hallucinationRate: number;
  avgRetries: number;
  verificationSuccessRate: number;
  ewmaScore: number;
}> {
  const result: ReturnType<typeof exportSummaries> = {};
  for (const agentId of _history.keys()) {
    result[agentId] = {
      totalRuns:               getTotalRuns(agentId),
      successRate:             getSuccessRate(agentId),
      hallucinationRate:       getHallucinationRate(agentId),
      avgRetries:              getAverageRetries(agentId),
      verificationSuccessRate: getVerificationSuccessRate(agentId),
      ewmaScore:               computeReliabilityScore(agentId),
    };
  }
  return result;
}
