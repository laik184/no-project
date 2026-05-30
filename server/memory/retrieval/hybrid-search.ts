/**
 * server/memory/retrieval/hybrid-search.ts
 *
 * Purpose: Hybrid retrieval combining semantic BM25 and TF-IDF vector scores.
 * Responsibility: Merge and normalise scores from both retrievers.
 *   Delegates to semanticSearch + vectorSearch; does not duplicate logic.
 * Exports: HybridSearch, hybridSearch (singleton)
 */

import type { MemoryEntry }         from '../types/memory.types.ts';
import type { RankedResult, HybridWeights, DEFAULT_HYBRID_WEIGHTS } from '../types/search.types.ts';
import { semanticSearch }           from './semantic-search.ts';
import { vectorSearch }             from './vector-search.ts';

const DEFAULTS: HybridWeights = { semantic: 0.4, vector: 0.6 };

export class HybridSearch {

  rank<T extends MemoryEntry>(
    query:   string,
    entries: T[],
    limit:   number,
    weights: HybridWeights = DEFAULTS,
  ): RankedResult<T>[] {
    // Ensure vector index is populated for these entries
    vectorSearch.bulkIndex(entries);

    // Score from both retrievers
    const semResults = semanticSearch.rank(query, entries, entries.length);
    const vecResults = vectorSearch.rank(query, entries, entries.length);

    // Build lookup maps by entry id
    const semMap = new Map(semResults.map(r => [r.entry.id, r]));
    const vecMap = new Map(vecResults.map(r => [r.entry.id, r]));

    // Merge: for each entry present in either result set, compute hybrid score
    const allIds = new Set([...semMap.keys(), ...vecMap.keys()]);
    const merged: RankedResult<T>[] = [];

    for (const id of allIds) {
      const sem = semMap.get(id);
      const vec = vecMap.get(id);
      const entry = (sem?.entry ?? vec?.entry)!;

      const semScore = sem?.relevance ?? 0;
      const vecScore = vec?.relevance ?? 0;
      const combined = semScore * weights.semantic + vecScore * weights.vector;

      const matchedTerms = [
        ...(sem?.matchedTerms ?? []),
        ...(vec?.matchedTerms ?? []),
      ];

      merged.push({
        entry,
        relevance:    combined,
        matchedTerms: [...new Set(matchedTerms)],
        retrievalMode: 'hybrid',
      });
    }

    return merged
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }
}

export const hybridSearch = new HybridSearch();
