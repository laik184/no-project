/**
 * server/memory/retrieval/vector-search.ts
 *
 * Purpose: TF-IDF vector space model with cosine similarity search.
 * Responsibility: Build term vectors from entries, compute cosine similarity
 *   against a query vector. No embedding API required.
 * Exports: VectorSearch, vectorSearch (singleton)
 */

import type { MemoryEntry } from '../types/memory.types.ts';
import type { TermVector, RankedResult } from '../types/search.types.ts';

// ── TF-IDF utilities ──────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  for (const [t, c] of tf) tf.set(t, c / total);
  return tf;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [t, wa] of a) {
    dot   += wa * (b.get(t) ?? 0);
    normA += wa * wa;
  }
  for (const [, wb] of b) normB += wb * wb;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Vector index ──────────────────────────────────────────────────────────────

export class VectorSearch {
  private index = new Map<string, TermVector>();

  /** Index a memory entry (call after create/update). */
  index_(entry: MemoryEntry): void {
    const text   = `${entry.content} ${entry.tags.join(' ')}`;
    const tokens = tokenize(text);
    const tf     = termFrequency(tokens);
    this.index.set(entry.id, { entryId: entry.id, terms: tf });
  }

  /** Remove an entry from the index. */
  remove(id: string): void {
    this.index.delete(id);
  }

  /** Bulk-index a collection of entries. */
  bulkIndex(entries: MemoryEntry[]): void {
    for (const e of entries) this.index_(e);
  }

  /** Return cosine similarity between query and a specific entry. */
  score(query: string, entryId: string): number {
    const qVec = termFrequency(tokenize(query));
    const dVec = this.index.get(entryId);
    if (!dVec) return 0;
    return cosineSimilarity(qVec, dVec.terms);
  }

  /**
   * Rank entries by cosine similarity to query.
   * Only entries present in the index are considered.
   */
  rank<T extends MemoryEntry>(
    query:   string,
    entries: T[],
    limit:   number,
  ): RankedResult<T>[] {
    const qVec = termFrequency(tokenize(query));

    return entries
      .map(e => {
        const dVec = this.index.get(e.id);
        const sim  = dVec ? cosineSimilarity(qVec, dVec.terms) : 0;
        return {
          entry:         e,
          relevance:     sim,
          matchedTerms:  dVec
            ? [...qVec.keys()].filter(t => dVec.terms.has(t))
            : [],
          retrievalMode: 'vector' as const,
        };
      })
      .filter(r => r.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /** Number of indexed entries. */
  indexSize(): number {
    return this.index.size;
  }
}

export const vectorSearch = new VectorSearch();
