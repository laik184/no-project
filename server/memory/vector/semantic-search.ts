/**
 * semantic-search.ts
 *
 * In-memory + pgvector semantic search over memory entries.
 * Automatically uses pgvector when available, falls back to JS cosine search.
 */

import { cosineSimilarity, generateEmbedding } from "./embedding-engine.ts";
import { rankMemories, deduplicateRanked }      from "./memory-ranking.ts";
import { temporalMultiplier, markRetrieved, filterByTimeWindow } from "./temporal-weighting.ts";
import type { MemoryEntry, SearchOptions, RankedMemory } from "./vector-types.ts";

// ── In-memory index (L2 cache) ────────────────────────────────────────────────

const _memoryCache = new Map<string, MemoryEntry>();

export function cacheMemory(entry: MemoryEntry): void {
  if (entry.id) _memoryCache.set(entry.id, entry);
}

export function invalidateCache(memoryId: string): void {
  _memoryCache.delete(memoryId);
}

export function clearAllCache(): void {
  _memoryCache.clear();
}

// ── JS cosine search ──────────────────────────────────────────────────────────

function jsCosineScan(
  queryEmbedding: number[],
  candidates:     MemoryEntry[],
  minScore:       number,
): Array<{ memory: MemoryEntry; similarity: number }> {
  return candidates
    .filter(m => m.embedding?.length)
    .map(m => ({
      memory:     m,
      similarity: cosineSimilarity(queryEmbedding, m.embedding!),
    }))
    .filter(r => r.similarity >= minScore);
}

// ── Core search ───────────────────────────────────────────────────────────────

export async function semanticSearch(
  candidates: MemoryEntry[],     // loaded from DB by caller
  opts:       SearchOptions,
): Promise<RankedMemory[]> {
  if (candidates.length === 0) return [];

  // Filter by time window if requested
  let pool = opts.maxAgeMs
    ? filterByTimeWindow(candidates, opts.maxAgeMs)
    : candidates;

  // Filter by category
  if (opts.categories && opts.categories.length > 0) {
    pool = pool.filter(m => opts.categories!.includes(m.category));
  }

  // Filter by projectId (null = global/shared)
  if (opts.projectId !== undefined) {
    pool = pool.filter(m => m.projectId === opts.projectId || m.projectId === undefined);
  }

  if (pool.length === 0) return [];

  // Generate query embedding
  const queryResult = await generateEmbedding(opts.query);

  // Cosine scan
  const rawResults = jsCosineScan(queryResult.embedding, pool, opts.minScore);

  // Apply temporal multiplier to similarity
  const adjusted = rawResults.map(r => ({
    memory:     r.memory,
    similarity: r.similarity * temporalMultiplier(r.memory),
  }));

  // Rank + deduplicate
  const ranked = rankMemories(adjusted, opts.topK * 2, opts.minScore);
  const deduped = deduplicateRanked(ranked, 0.90);

  // Mark retrieved + trim to topK
  const final = deduped.slice(0, opts.topK);
  for (const r of final) {
    if (r.memory.id) markRetrieved(r.memory.id);
  }

  return final;
}

// ── Exact keyword search fallback ─────────────────────────────────────────────

export function keywordSearch(
  candidates: MemoryEntry[],
  query:      string,
  topK:       number,
): MemoryEntry[] {
  const lower  = query.toLowerCase();
  const words  = lower.split(/\s+/).filter(w => w.length > 3);

  const scored = candidates.map(m => {
    const content = m.content.toLowerCase();
    const hits    = words.filter(w => content.includes(w)).length;
    return { m, hits };
  });

  return scored
    .filter(s => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, topK)
    .map(s => s.m);
}
