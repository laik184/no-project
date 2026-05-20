/**
 * memory-ranking.ts
 *
 * Ranks retrieved memories using a weighted combination of:
 * - Semantic similarity (cosine)
 * - Recency (time decay)
 * - Usage frequency (retrieval count boost)
 */

import { SCORE_WEIGHTS } from "./vector-types.ts";
import type { MemoryEntry, RankedMemory } from "./vector-types.ts";

// ── Time decay ────────────────────────────────────────────────────────────────

/** Exponential decay: score = e^(-λ*t), half-life = 7 days */
const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
const LAMBDA = Math.log(2) / HALF_LIFE_MS;

export function recencyScore(createdAt: number, lastUsedAt: number): number {
  const refTime = Math.max(createdAt, lastUsedAt);
  const ageMs   = Date.now() - refTime;
  return Math.exp(-LAMBDA * Math.max(0, ageMs));
}

// ── Usage boost ───────────────────────────────────────────────────────────────

/** Log-scaled usage frequency: 0 uses → 0, 10 uses → ~0.7, 100 uses → 1.0 */
export function usageScore(usedCount: number): number {
  if (usedCount <= 0) return 0;
  return Math.min(1.0, Math.log10(usedCount + 1) / 2);
}

// ── Final score ───────────────────────────────────────────────────────────────

export function computeFinalScore(
  similarity: number,
  memory:     MemoryEntry,
): number {
  const rec = recencyScore(memory.createdAt, memory.lastUsedAt);
  const usg = usageScore(memory.usedCount);

  return (
    similarity * SCORE_WEIGHTS.similarity +
    rec        * SCORE_WEIGHTS.recency    +
    usg        * SCORE_WEIGHTS.usage
  );
}

// ── Relevance note ────────────────────────────────────────────────────────────

export function buildRelevanceNote(
  similarity: number,
  memory:     MemoryEntry,
): string {
  const parts: string[] = [];

  if (similarity >= 0.9)     parts.push("highly similar");
  else if (similarity >= 0.7) parts.push("similar");
  else                        parts.push("loosely related");

  const ageDays = Math.floor((Date.now() - memory.createdAt) / (24 * 60 * 60 * 1000));
  if (ageDays === 0)          parts.push("from today");
  else if (ageDays < 7)       parts.push(`from ${ageDays}d ago`);
  else                        parts.push("older memory");

  if (memory.usedCount >= 5) parts.push(`retrieved ${memory.usedCount}x`);

  return parts.join(", ");
}

// ── Ranker ────────────────────────────────────────────────────────────────────

export function rankMemories(
  memories:    Array<{ memory: MemoryEntry; similarity: number }>,
  topK:        number,
  minScore:    number,
): RankedMemory[] {
  const ranked: RankedMemory[] = [];

  for (const { memory, similarity } of memories) {
    if (similarity < minScore) continue;

    const rec        = recencyScore(memory.createdAt, memory.lastUsedAt);
    const usg        = usageScore(memory.usedCount);
    const finalScore = computeFinalScore(similarity, memory);

    ranked.push({
      memory,
      similarity,
      recencyScore: rec,
      usageScore:   usg,
      finalScore,
      relevanceNote: buildRelevanceNote(similarity, memory),
    });
  }

  return ranked
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/** Remove near-duplicate memories from ranked results. */
export function deduplicateRanked(
  ranked:    RankedMemory[],
  threshold: number = 0.92,
): RankedMemory[] {
  const kept: RankedMemory[] = [];

  for (const candidate of ranked) {
    const isDuplicate = kept.some(k => {
      // Simple text deduplication — not embedding-based (no re-embedding cost)
      const shorter = Math.min(k.memory.content.length, candidate.memory.content.length);
      const sharedPrefixLen = [...k.memory.content.slice(0, shorter)]
        .filter((c, i) => c === candidate.memory.content[i]).length;
      return sharedPrefixLen / shorter >= threshold;
    });

    if (!isDuplicate) kept.push(candidate);
  }

  return kept;
}
