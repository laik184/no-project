/**
 * server/memory/retrieval/reranker.ts
 *
 * Purpose: Re-ranks search results using composite scoring signals.
 * Responsibility: Combine relevance, recency, entry quality score, and
 *   matched term count into a final ranking score.
 * Exports: Reranker, reranker (singleton)
 */

import type { MemoryEntry }  from '../types/memory.types.ts';
import type { RankedResult, RerankerInput } from '../types/search.types.ts';

// ── Weights ───────────────────────────────────────────────────────────────────

interface RerankWeights {
  relevance:    number;   // retrieval score
  entryScore:   number;   // stored quality score
  recency:      number;   // how recent the entry is
  termOverlap:  number;   // fraction of query terms matched
}

const DEFAULT_WEIGHTS: RerankWeights = {
  relevance:   0.50,
  entryScore:  0.20,
  recency:     0.15,
  termOverlap: 0.15,
};

// ── Recency decay ─────────────────────────────────────────────────────────────

function recencyScore(createdAt: number, halfLifeMs = 30 * 24 * 60 * 60 * 1000): number {
  const age = Date.now() - createdAt;
  return Math.exp(-age / halfLifeMs);
}

// ── Reranker ──────────────────────────────────────────────────────────────────

export class Reranker {

  rerank<T extends MemoryEntry>(
    input:   RerankerInput<T>,
    weights: RerankWeights = DEFAULT_WEIGHTS,
  ): RankedResult<T>[] {
    const qTermCount = new Set(
      input.query.text.toLowerCase().split(/\s+/).filter(t => t.length > 2),
    ).size;

    const scored = input.results.map(r => {
      const termOverlap = qTermCount > 0
        ? r.matchedTerms.length / qTermCount
        : 0;

      const composite =
        r.relevance          * weights.relevance  +
        r.entry.score        * weights.entryScore +
        recencyScore(r.entry.createdAt) * weights.recency +
        termOverlap          * weights.termOverlap;

      return { ...r, relevance: Math.min(composite, 1) };
    });

    return scored.sort((a, b) => b.relevance - a.relevance);
  }

  /** Filter results below a minimum relevance threshold. */
  filter<T extends MemoryEntry>(
    results:  RankedResult<T>[],
    minScore: number,
  ): RankedResult<T>[] {
    return results.filter(r => r.relevance >= minScore);
  }
}

export const reranker = new Reranker();
