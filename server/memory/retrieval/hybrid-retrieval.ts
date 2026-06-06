/**
 * server/memory/retrieval/hybrid-retrieval.ts
 * Hybrid search — combines vector similarity (alpha) + keyword scoring (1-alpha).
 */

import { embeddingService }         from '../embedding/embedding-service.ts';
import { vectorSearch }             from '../vector/vector-search.ts';
import type { RetrievalResult }     from './retrieval-service.ts';

function keywordScore(text: string, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return 0;
  const lower = text.toLowerCase();
  const hits  = words.filter(w => lower.includes(w)).length;
  return hits / words.length;
}

export async function hybridSearch(
  query:  string,
  topK:   number = 10,
  alpha:  number = 0.7,
): Promise<RetrievalResult[]> {
  const queryVec      = await embeddingService.embed(query);
  const vectorResults = vectorSearch(queryVec, topK * 3);

  const combined = vectorResults.map(r => {
    const content = String(r.record.metadata['content'] ?? '');
    const kw      = keywordScore(content, query);
    const score   = alpha * r.similarity + (1 - alpha) * kw;
    return {
      id:         r.record.id,
      content,
      similarity: score,
      metadata:   r.record.metadata,
    };
  });

  return combined
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
