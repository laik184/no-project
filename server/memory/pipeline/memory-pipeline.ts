/**
 * memory-pipeline.ts — vector agent stubs inlined.
 */

import { classifyMemory }  from "../classifier/memory-classifier.ts";
import { memoryTelemetry } from "../telemetry/memory-telemetry.ts";
import { randomUUID }      from "crypto";
import type { MemoryEntry, SearchOptions, RankedMemory } from "../types.ts";

import {
  _store, enforceCapacity, getProjectEntries,
  getAllEntries, getStoreStats, reconcile, archive,
} from "./memory-store-internal.ts";

export { getProjectEntries, getAllEntries, getStoreStats, reconcile, archive };

// ── Inlined vector stubs ──────────────────────────────────────────────────────

function generateEmbedding(_text: string): { embedding: number[] } { return { embedding: [] }; }
function cacheMemory(_entry: MemoryEntry): void {}
function semanticSearch(_candidates: MemoryEntry[], _opts: SearchOptions): RankedMemory[] { return []; }
function keywordSearch(candidates: MemoryEntry[], query: string, limit: number): MemoryEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return candidates
    .filter(e => words.some(w => e.content.toLowerCase().includes(w)))
    .slice(0, limit);
}
function computeFinalScore(similarity: number, entry: MemoryEntry): number {
  return similarity * 0.7 + Math.min(entry.score, 1) * 0.3;
}

// ── Observe ───────────────────────────────────────────────────────────────────

export interface ObserveInput {
  content:   string;
  projectId: number;
  runId?:    string;
  context?:  string;
  hint?:     Partial<{ success: boolean; fromReflection: boolean; fromRuntime: boolean }>;
}

export async function observe(input: ObserveInput): Promise<MemoryEntry | null> {
  const { content, projectId, runId, context, hint } = input;
  if (!content?.trim()) return null;

  try {
    const classification = classifyMemory(content, hint);

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

    try {
      const embResult = generateEmbedding(entry.content);
      entry.embedding = embResult.embedding;
    } catch { /* non-blocking */ }

    const existing    = [..._store.values()].filter(e => e.projectId === projectId);
    const isDuplicate = existing.some(e => {
      const shorter = Math.min(e.content.length, entry.content.length);
      if (shorter === 0) return false;
      const sharedLen = [...e.content.slice(0, shorter)]
        .filter((c, i) => c === entry.content[i]).length;
      return sharedLen / shorter >= 0.92;
    });

    if (isDuplicate) return null;

    enforceCapacity(projectId);
    _store.set(entry.id!, entry);
    cacheMemory(entry);

    memoryTelemetry.created({ entryId: entry.id!, category: entry.category, projectId, score: entry.score, tags: entry.tags });
    return entry;

  } catch (err) {
    memoryTelemetry.failed({ operation: "observe", projectId, reason: (err as Error).message, runId });
    return null;
  }
}

// ── Rank ──────────────────────────────────────────────────────────────────────

export function rank(entries: MemoryEntry[], query: string): RankedMemory[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const scored = entries.map(entry => {
    const lower      = entry.content.toLowerCase();
    const hits       = words.filter(w => lower.includes(w)).length;
    const similarity = Math.min(1.0, hits / Math.max(1, words.length));
    const finalScore = computeFinalScore(similarity, entry);
    return { memory: entry, similarity, recencyScore: 0, usageScore: 0, finalScore, relevanceNote: "" };
  });

  return scored.filter(r => r.finalScore > 0).sort((a, b) => b.finalScore - a.finalScore).slice(0, 10);
}

// ── Retrieve ──────────────────────────────────────────────────────────────────

export async function retrieve(
  query:     string,
  projectId: number,
  runId?:    string,
  opts?:     Partial<SearchOptions>,
): Promise<RankedMemory[]> {
  const candidates = [..._store.values()].filter(e => e.projectId === projectId || e.projectId === undefined);
  if (candidates.length === 0) return [];

  let results: RankedMemory[];

  try {
    results = semanticSearch(candidates, { query, projectId, topK: opts?.topK ?? 8, minScore: opts?.minScore ?? 0.25 });
    if (results.length === 0) {
      results = rank(keywordSearch(candidates, query, 5), query);
    }
  } catch {
    results = rank(keywordSearch(candidates, query, 5), query);
  }

  for (const r of results) {
    if (r.memory.id) {
      const entry = _store.get(r.memory.id);
      if (entry) { entry.usedCount++; entry.lastUsedAt = Date.now(); }
    }
  }

  memoryTelemetry.retrieved({
    runId: runId ?? "unknown", projectId,
    query:       query.slice(0, 100),
    resultCount: results.length,
    topScore:    results[0]?.finalScore ?? 0,
    strategy:    results.length > 0 ? "semantic" : "keyword",
  });

  return results;
}
