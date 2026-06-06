/**
 * server/memory/vector/vector-search.ts
 * Cosine-similarity search over the shared VectorStore.
 */

import { vectorStore, type VectorRecord } from './vector-store.ts';

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface SearchResult {
  record:     VectorRecord;
  similarity: number;
}

export function vectorSearch(
  queryVector: number[],
  topK:        number = 10,
  filter?:     (r: VectorRecord) => boolean,
): SearchResult[] {
  const all = vectorStore.getAll();
  const candidates = filter ? all.filter(filter) : all;

  return candidates
    .map(r => ({ record: r, similarity: cosine(queryVector, r.vector) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
