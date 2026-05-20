/**
 * temporal-weighting.ts
 *
 * Applies temporal weight adjustments to memory retrieval:
 * - Recency boost for memories accessed in the current session
 * - Cooldown for memories retrieved too recently (anti-spam)
 * - Importance decay for stale memories
 */

import type { MemoryEntry, MemoryCategory } from "./vector-types.ts";

// ── Session cache ─────────────────────────────────────────────────────────────

const _sessionRetrieved = new Map<string, number>();   // memoryId → last retrieved ts

export function markRetrieved(memoryId: string): void {
  _sessionRetrieved.set(memoryId, Date.now());
}

export function clearSessionCache(): void {
  _sessionRetrieved.clear();
}

// ── Cooldown ──────────────────────────────────────────────────────────────────

const COOLDOWN_MS = 30_000;  // 30 seconds

export function isOnCooldown(memoryId: string): boolean {
  const last = _sessionRetrieved.get(memoryId);
  return last !== undefined && (Date.now() - last) < COOLDOWN_MS;
}

// ── Age limits per category ───────────────────────────────────────────────────

/** Maximum useful age in days per category. Older → deprioritized. */
const MAX_USEFUL_AGE_DAYS: Record<MemoryCategory, number> = {
  pattern:      180,   // patterns stay relevant for months
  fact:         90,    // facts may become outdated
  preference:   365,   // user preferences are long-lived
  failure:      30,    // past failures may be solved now
  success:      90,
  architecture: 365,
  dependency:   14,    // packages change fast
  runtime:      7,     // runtime incidents are very time-sensitive
};

export function isTooOld(memory: MemoryEntry): boolean {
  const maxDays  = MAX_USEFUL_AGE_DAYS[memory.category];
  const ageDays  = (Date.now() - memory.createdAt) / (24 * 60 * 60 * 1000);
  return ageDays > maxDays;
}

// ── Temporal multiplier ───────────────────────────────────────────────────────

/**
 * Returns a multiplier [0.0–1.5] for the base score.
 * Recent session retrieval → boost. On cooldown → suppress. Too old → reduce.
 */
export function temporalMultiplier(memory: MemoryEntry): number {
  if (!memory.id) return 1.0;

  // Cooldown penalty
  if (isOnCooldown(memory.id)) return 0.1;

  // Age penalty
  if (isTooOld(memory)) {
    const maxDays = MAX_USEFUL_AGE_DAYS[memory.category];
    const ageDays = (Date.now() - memory.createdAt) / (24 * 60 * 60 * 1000);
    return Math.max(0.2, 1.0 - (ageDays - maxDays) / maxDays);
  }

  // Session boost: if retrieved earlier this session but not on cooldown
  const lastRetrieved = _sessionRetrieved.get(memory.id);
  if (lastRetrieved) return 1.2;

  return 1.0;
}

// ── Time window filter ────────────────────────────────────────────────────────

export function filterByTimeWindow(
  memories: MemoryEntry[],
  maxAgeMs: number,
): MemoryEntry[] {
  const cutoff = Date.now() - maxAgeMs;
  return memories.filter(m => m.createdAt >= cutoff || m.lastUsedAt >= cutoff);
}
