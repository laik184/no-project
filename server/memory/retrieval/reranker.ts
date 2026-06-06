/**
 * server/memory/retrieval/reranker.ts
 * Re-rank retrieval results — boosts exact phrase matches.
 */

import type { RetrievalResult } from './retrieval-service.ts';

export interface RerankOptions {
  boostExact?: number;
  minScore?:   number;
}

export function rerank(
  results:  RetrievalResult[],
  query:    string,
  opts:     RerankOptions = {},
): RetrievalResult[] {
  const boost    = opts.boostExact ?? 0.2;
  const minScore = opts.minScore   ?? 0;
  const lower    = query.toLowerCase();

  return results
    .map(r => ({
      ...r,
      similarity: r.similarity + (r.content.toLowerCase().includes(lower) ? boost : 0),
    }))
    .filter(r => r.similarity >= minScore)
    .sort((a, b) => b.similarity - a.similarity);
}
