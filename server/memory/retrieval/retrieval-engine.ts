/**
 * server/memory/retrieval/retrieval-engine.ts
 *
 * Purpose: Unified retrieval API for the memory platform.
 * Responsibility: Route queries to the correct search mode, apply reranking,
 *   and return typed SearchResult envelopes.
 * Exports: RetrievalEngine, retrievalEngine (singleton)
 */

import { memoryRegistry }   from '../core/memory-registry.ts';
import { semanticSearch }   from './semantic-search.ts';
import { vectorSearch }     from './vector-search.ts';
import { hybridSearch }     from './hybrid-search.ts';
import { reranker }         from './reranker.ts';
import type { MemoryEntry } from '../types/memory.types.ts';
import type {
  SearchQuery,
  SearchResult,
  RankedResult,
} from '../types/search.types.ts';

export class RetrievalEngine {

  async search<T extends MemoryEntry = MemoryEntry>(
    query: SearchQuery,
  ): Promise<SearchResult<T>> {
    const start     = Date.now();
    const mode      = query.mode ?? 'hybrid';
    const limit     = query.limit ?? 20;
    const minScore  = query.minScore ?? 0;

    // Collect candidate entries from relevant stores
    const categories = query.categories ?? memoryRegistry.categories();
    const allEntries: T[] = [];

    await Promise.all(
      categories.map(async (cat) => {
        if (!memoryRegistry.has(cat)) return;
        const store   = memoryRegistry.get<T>(cat);
        const entries = await store.list({ excludeStale: !query.includeStale });
        allEntries.push(...entries);
      }),
    );

    // Score
    let results: RankedResult<T>[];
    switch (mode) {
      case 'semantic':
        results = semanticSearch.rank(query.text, allEntries, limit * 3);
        break;
      case 'vector':
        vectorSearch.bulkIndex(allEntries);
        results = vectorSearch.rank(query.text, allEntries, limit * 3);
        break;
      default:
        results = hybridSearch.rank(query.text, allEntries, limit * 3);
    }

    // Filter by tags if specified
    if (query.tags && query.tags.length > 0) {
      const required = new Set(query.tags);
      results = results.filter(r => r.entry.tags.some(t => required.has(t)));
    }

    // Rerank and apply minScore
    const reranked = reranker.rerank({ query, results });
    const filtered = minScore > 0 ? reranker.filter(reranked, minScore) : reranked;
    const final    = filtered.slice(0, limit);

    return {
      query,
      results:    final,
      totalFound: final.length,
      durationMs: Date.now() - start,
    };
  }
}

export const retrievalEngine = new RetrievalEngine();
