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
import { deduplicateRanked }    from "../../agents/memory/vector/memory-ranking.ts";
import { computeFinalScore }    from "../../agents/memory/vector/memory-ranking.ts";
import type { MemoryEntry, SearchOptions, RankedMemory } from "../../agents/memory/vector/vector-types.ts";
import { randomUUID }           from "crypto";

// ── In-process store (wraps the semantic cache) ────────────────────────────────

const _store = new Map<string, MemoryEntry>();
const MAX_ENTRIES_PER_PROJECT = 500;

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
    _enforceCapacity(projectId);
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

// ── Stage 9: Reconcile ────────────────────────────────────────────────────────

export function reconcile(projectId: number): void {
  const entries = [..._store.values()].filter(e => e.projectId === projectId);
  const seen    = new Map<string, MemoryEntry>();
  const removed: string[] = [];

  for (const entry of entries) {
    const key = entry.content.slice(0, 80).toLowerCase().trim();
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      // Keep the higher-scored, more recent one
      if (entry.score > existing.score || entry.createdAt > existing.createdAt) {
        _store.delete(existing.id!);
        removed.push(existing.id!);
        seen.set(key, entry);
      } else {
        _store.delete(entry.id!);
        removed.push(entry.id!);
      }
    } else {
      seen.set(key, entry);
    }
  }

  if (removed.length > 0) {
    memoryTelemetry.reconciled({
      conflictId:  `reconcile-${projectId}-${Date.now()}`,
      resolution:  "kept_higher_confidence",
      affectedIds: removed,
    });
  }
}

// ── Stage 11: Archive ─────────────────────────────────────────────────────────

export function archive(projectId: number): void {
  const now     = Date.now();
  const entries = [..._store.values()].filter(e => e.projectId === projectId);

  for (const entry of entries) {
    const isLowScore = entry.score < 0.2;
    const isStale    = entry.lastUsedAt < now - 30 * 24 * 60 * 60 * 1000 && entry.usedCount === 0;

    if (isLowScore || isStale) {
      _store.delete(entry.id!);
      memoryTelemetry.archived({
        entryId:   entry.id!,
        reason:    isStale ? "expired" : "low_score",
        projectId,
      });
    }
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getProjectEntries(projectId: number): MemoryEntry[] {
  return [..._store.values()].filter(e => e.projectId === projectId);
}

export function getAllEntries(): MemoryEntry[] {
  return [..._store.values()];
}

export function getStoreStats(): { total: number; byCategory: Record<string, number>; byProject: Record<string, number> } {
  const entries    = [..._store.values()];
  const byCategory: Record<string, number> = {};
  const byProject:  Record<string, number> = {};

  for (const e of entries) {
    byCategory[e.category]          = (byCategory[e.category] ?? 0) + 1;
    const pKey = String(e.projectId ?? "global");
    byProject[pKey] = (byProject[pKey] ?? 0) + 1;
  }

  return { total: entries.length, byCategory, byProject };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _enforceCapacity(projectId: number): void {
  const projectEntries = [..._store.entries()].filter(([, e]) => e.projectId === projectId);
  if (projectEntries.length < MAX_ENTRIES_PER_PROJECT) return;

  // Evict lowest-score + oldest entries
  const sorted = projectEntries.sort(([, a], [, b]) =>
    (a.score + a.usedCount * 0.01) - (b.score + b.usedCount * 0.01),
  );
  const toEvict = sorted.slice(0, Math.ceil(MAX_ENTRIES_PER_PROJECT * 0.1));
  for (const [id, entry] of toEvict) {
    _store.delete(id);
    memoryTelemetry.archived({ entryId: id, reason: "overflow", projectId: entry.projectId ?? 0 });
  }
}
