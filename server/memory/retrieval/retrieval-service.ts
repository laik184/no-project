/**
 * server/memory/retrieval/retrieval-service.ts
 * Retrieve top matches by embedding similarity.
 */

import { embeddingService }             from '../embedding/embedding-service.ts';
import { vectorSearch }                 from '../vector/vector-search.ts';
import type { VectorRecord }            from '../vector/vector-store.ts';

export interface RetrievalOptions {
  topK?:     number;
  minScore?: number;
  filter?:   (record: VectorRecord) => boolean;
}

export interface RetrievalResult {
  id:         string;
  content:    string;
  similarity: number;
  metadata:   Record<string, unknown>;
}

export async function retrieve(
  query:   string,
  options: RetrievalOptions = {},
): Promise<RetrievalResult[]> {
  const { topK = 10, minScore = 0, filter } = options;

  const queryVec = await embeddingService.embed(query);
  const results  = vectorSearch(queryVec, topK * 2, filter);

  return results
    .filter(r => r.similarity >= minScore)
    .slice(0, topK)
    .map(r => ({
      id:         r.record.id,
      content:    String(r.record.metadata['content'] ?? ''),
      similarity: r.similarity,
      metadata:   r.record.metadata,
    }));
}
