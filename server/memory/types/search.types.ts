/**
 * server/memory/types/search.types.ts
 *
 * Purpose: Type contracts for the retrieval and search subsystem.
 * Responsibility: Unified search query/result interfaces. No runtime logic.
 * Exports: SearchQuery, SearchResult, RetrievalMode, RankedResult
 */

import type { MemoryEntry, MemoryCategory } from './memory.types.ts';

// ── Retrieval mode ────────────────────────────────────────────────────────────

export type RetrievalMode = 'semantic' | 'vector' | 'hybrid';

// ── Search query ──────────────────────────────────────────────────────────────

export interface SearchQuery {
  text:          string;
  mode?:         RetrievalMode;
  categories?:   MemoryCategory[];
  tags?:         string[];
  limit?:        number;
  minScore?:     number;
  /** Include stale (expired TTL) entries in results. Default: false. */
  includeStale?: boolean;
}

// ── Ranked result ─────────────────────────────────────────────────────────────

export interface RankedResult<T extends MemoryEntry = MemoryEntry> {
  entry:          T;
  /** Retrieval relevance score: 0.0–1.0 */
  relevance:      number;
  matchedTerms:   string[];
  retrievalMode:  RetrievalMode;
}

// ── Search result envelope ────────────────────────────────────────────────────

export interface SearchResult<T extends MemoryEntry = MemoryEntry> {
  query:       SearchQuery;
  results:     RankedResult<T>[];
  totalFound:  number;
  durationMs:  number;
}

// ── Term vector (TF-IDF) ──────────────────────────────────────────────────────

export interface TermVector {
  entryId: string;
  terms:   Map<string, number>;   // term → TF-IDF weight
}

// ── Reranker input ────────────────────────────────────────────────────────────

export interface RerankerInput<T extends MemoryEntry = MemoryEntry> {
  query:   SearchQuery;
  results: RankedResult<T>[];
}

// ── Hybrid search config ──────────────────────────────────────────────────────

export interface HybridWeights {
  /** Weight for keyword/semantic score: 0.0–1.0 */
  semantic: number;
  /** Weight for vector similarity score: 0.0–1.0 */
  vector:   number;
}

export const DEFAULT_HYBRID_WEIGHTS: HybridWeights = {
  semantic: 0.4,
  vector:   0.6,
};
