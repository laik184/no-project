/**
 * server/memory/retrieval/semantic-search.ts
 *
 * Purpose: Keyword + BM25-style semantic search over memory entries.
 * Responsibility: Score entries against a query using term overlap and
 *   field-weighted matching. No external dependencies.
 * Exports: SemanticSearch, semanticSearch (singleton)
 */

import type { MemoryEntry }    from '../types/memory.types.ts';
import type { RankedResult }   from '../types/search.types.ts';

// ── Tokenizer ─────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'are', 'was',
  'has', 'have', 'from', 'not', 'but', 'can', 'its', 'been',
]);

function filterStops(tokens: string[]): string[] {
  return tokens.filter(t => !STOP_WORDS.has(t));
}

// ── BM25 parameters ───────────────────────────────────────────────────────────

const K1 = 1.5;
const B  = 0.75;
const AVG_DOC_LEN = 50;  // assumed average token count

function bm25Score(qTerms: string[], docTerms: string[], docLen: number): number {
  let score = 0;
  const tf = new Map<string, number>();
  for (const t of docTerms) tf.set(t, (tf.get(t) ?? 0) + 1);

  for (const term of qTerms) {
    const f   = tf.get(term) ?? 0;
    if (f === 0) continue;
    const idf = 1;   // single-corpus approximation
    const num = f * (K1 + 1);
    const den = f + K1 * (1 - B + B * (docLen / AVG_DOC_LEN));
    score += idf * (num / den);
  }
  return score;
}

// ── Searcher ──────────────────────────────────────────────────────────────────

export class SemanticSearch {

  score(query: string, entry: MemoryEntry): number {
    const qTerms = filterStops(tokenize(query));
    if (qTerms.length === 0) return 0;

    // Content tokens weighted 1×; tag tokens weighted 2×
    const contentTokens = filterStops(tokenize(entry.content));
    const tagTokens     = filterStops(tokenize(entry.tags.join(' ')));
    const allTokens     = [...contentTokens, ...tagTokens, ...tagTokens];

    const raw = bm25Score(qTerms, allTokens, allTokens.length);
    // Normalise to 0–1 using a soft cap
    return Math.min(raw / (qTerms.length * 3), 1);
  }

  matchedTerms(query: string, entry: MemoryEntry): string[] {
    const qTerms = new Set(filterStops(tokenize(query)));
    const dTerms = filterStops(tokenize(`${entry.content} ${entry.tags.join(' ')}`));
    return dTerms.filter(t => qTerms.has(t));
  }

  rank<T extends MemoryEntry>(
    query:   string,
    entries: T[],
    limit:   number,
  ): RankedResult<T>[] {
    return entries
      .map(e => ({
        entry:         e,
        relevance:     this.score(query, e),
        matchedTerms:  this.matchedTerms(query, e),
        retrievalMode: 'semantic' as const,
      }))
      .filter(r => r.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }
}

export const semanticSearch = new SemanticSearch();
