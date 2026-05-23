/**
 * memory-pipeline.ts
 *
 * The central memory lifecycle orchestrator.
 *
 * Complete pipeline:
 *   observe → classify → score → deduplicate → persist → rank
 *           → retrieve → inject → reconcile → promote → archive
 *
 * Single responsibility: lifecycle coordination only.
 * Delegates each stage to its bounded-context module.
 * Safe-by-design: any stage failure is caught and logged; pipeline continues.
 */

import { classifyMemory }       from "../classifier/memory-classifier.ts";
import { memoryTelemetry }      from "../telemetry/memory-telemetry.ts";
import { generateEmbedding }    from "../../agents/memory/vector/embedding-engine.ts";
import { cacheMemory, semanticSearch, keywordSearch } from "../../agents/memory/vector/semantic-search.ts";
import { computeFinalScore }    from "../../agents/memory/vector/memory-ranking.ts";
import type { MemoryEntry, SearchOptions, RankedMemory } from "../../agents/memory/vector/vector-types.ts";
import { randomUUID }           from "crypto";

// ── Store (delegated to memory-store-internal — Phase 1 split) ────────────────
import {
  _store,
  enforceCapacity,
  getProjectEntries,
  getAllEntries,
  getStoreStats,
  reconcile,
  archive,
} from "./memory-store-internal.ts";

export { getProjectEntries, getAllEntries, getStoreStats, reconcile, archive };

// ── Stage 1: Observe ──────────────────────────────────────────────────────────

export interface ObserveInput {
  content:   string;
  projectId: number;
  runId?:    string;
  context?:  string;
  hint?:     Partial<{ success: boolean; fromReflection: boolean; fromRuntime: boolean }>;
}

// ── Stage 2–5: Classify → Score → Deduplicate → Persist ───────────────────────

export async function observe(input: ObserveInput): Promise<MemoryEntry | null> {
  const { content, projectId, runId, context, hint } = input;
  if (!content?.trim()) return null;

  try {
    // Stage 2: Classify
    const classification = classifyMemory(content, hint);

    // Stage 3: Score
    const entry: MemoryEntry = {
      id:         randomUUID(),
      projectId,
      category:   classification.category,
      content:    content.slice(0, 2_000),
      context:    context?.slice(0, 500),
      tags:       classification.tags,
      score:      classification.score,
      usedCount:  0,
      createdAt:  Date.now(),
      lastUsedAt: Date.now(),
    };

    // Stage 3a: Generate embedding (async, non-blocking to persist)
    try {
      const embResult = await generateEmbedding(entry.content);
      entry.embedding = embResult.embedding;
    } catch {
      // Embedding failure does not block persistence
    }

    // Stage 4: Deduplicate — check for near-identical content
    const existing = [..._store.values()].filter(e => e.projectId === projectId);
    const isDuplicate = existing.some(e => {
      const shorter = Math.min(e.content.length, entry.content.length);
      if (shorter === 0) return false;
      const sharedLen = [...e.content.slice(0, shorter)]
        .filter((c, i) => c === entry.content[i]).length;
      return sharedLen / shorter >= 0.92;
    });

    if (isDuplicate) {
      return null; // Silently drop duplicate
    }

    // Stage 5: Persist (in-process cache + semantic index)
    enforceCapacity(projectId);
    _store.set(entry.id!, entry);
    cacheMemory(entry);

    memoryTelemetry.created({
      entryId:   entry.id!,
      category:  entry.category,
      projectId,
      score:     entry.score,
      tags:      entry.tags,
    });

    return entry;
  } catch (err) {
    memoryTelemetry.failed({
      operation: "observe",
      projectId,
      reason:    (err as Error).message,
      runId,
    });
    return null;
  }
}

// ── Stage 6: Rank ─────────────────────────────────────────────────────────────

export function rank(entries: MemoryEntry[], query: string): RankedMemory[] {
  // Simple scoring for ranking without embedding (fast path)
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const scored = entries.map(entry => {
    const lower      = entry.content.toLowerCase();
    const hits       = words.filter(w => lower.includes(w)).length;
    const similarity = Math.min(1.0, hits / Math.max(1, words.length));
    const finalScore = computeFinalScore(similarity, entry);
    return { memory: entry, similarity, recencyScore: 0, usageScore: 0, finalScore, relevanceNote: "" };
  });

  return scored
    .filter(r => r.finalScore > 0)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 10);
}

// ── Stage 7: Retrieve ──────────────────────────────────────────────────────────

export async function retrieve(
  query:     string,
  projectId: number,
  runId?:    string,
  opts?:     Partial<SearchOptions>,
): Promise<RankedMemory[]> {
  const candidates = [..._store.values()].filter(e =>
    e.projectId === projectId || e.projectId === undefined,
  );

  if (candidates.length === 0) return [];

  let results: RankedMemory[];

  try {
    // Semantic search (embedding-based)
    const searchOpts: SearchOptions = {
      query,
      projectId,
      topK:     opts?.topK     ?? 8,
      minScore: opts?.minScore ?? 0.25,
      categories: opts?.categories,
      maxAgeMs: opts?.maxAgeMs,
    };
    results = await semanticSearch(candidates, searchOpts);

    // Fallback: keyword search if semantic returns nothing
    if (results.length === 0) {
      const kwResults = keywordSearch(candidates, query, 5);
      results = rank(kwResults, query);
    }
  } catch {
    // Semantic search failed — use keyword fallback
    const kwResults = keywordSearch(candidates, query, 5);
    results = rank(kwResults, query);
  }

  // Update usage stats
  for (const r of results) {
    if (r.memory.id) {
      const entry = _store.get(r.memory.id);
      if (entry) {
        entry.usedCount++;
        entry.lastUsedAt = Date.now();
      }
    }
  }

  memoryTelemetry.retrieved({
    runId:       runId ?? "unknown",
    projectId,
    query:       query.slice(0, 100),
    resultCount: results.length,
    topScore:    results[0]?.finalScore ?? 0,
    strategy:    results.length > 0 ? "semantic" : "keyword",
  });

  return results;
}

// ── Stages 9 & 11 delegated to memory-store-internal (Phase 1 split) ─────────
// reconcile(), archive(), getProjectEntries(), getAllEntries(), getStoreStats()
// are re-exported above from memory-store-internal.ts
