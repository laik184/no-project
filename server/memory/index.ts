/**
 * server/memory/index.ts
 *
 * Public API for the Nura-X memory platform.
 *
 * Store flow:  content → chunker → embedding → repository → persistence → vector store
 * Search flow: query   → embedding → vector search → retrieval → ranked chunks
 *
 * Import chain enforced:
 *   index → repositories → persistence → infrastructure
 *   index → retrieval    → vector, embedding
 */

// ── Core public API ───────────────────────────────────────────────────────────

export { memoryRepository }                      from './repositories/index.ts';
export type { MemoryEntry, SaveInput, SearchOptions } from './repositories/index.ts';

export { embeddingService }                      from './embedding/index.ts';
export type { EmbeddingProvider }                from './embedding/index.ts';

export { vectorStore, vectorSearch }             from './vector/index.ts';
export type { VectorRecord, SearchResult }       from './vector/index.ts';

export { retrieve, hybridSearch, rerank }        from './retrieval/index.ts';
export type { RetrievalResult, RetrievalOptions } from './retrieval/index.ts';

export { chunkText, chunkCode, chunkMarkdown, chunkJson } from './chunking/index.ts';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

import { memoryRepository as _repo } from './repositories/memory-repository.ts';

export function bootstrapMemory(): void {
  _repo.init().catch((err: unknown) =>
    console.error('[memory] Hydration failed:', err),
  );
}

// ── memoryEngine — backward-compatible facade ─────────────────────────────────

export const memoryEngine = {
  store(input: {
    category: string;
    content:  string;
    tags?:    string[];
    score?:   number;
    meta?:    Record<string, unknown>;
  }): Promise<void> {
    return _repo.save(input).then(() => undefined);
  },

  searchCategory(
    category: string,
    query:    string,
    limit:    number = 10,
  ) {
    return _repo.searchByCategory(category, query, limit);
  },
};

// ── buildMemoryContext ────────────────────────────────────────────────────────

export interface MemoryContextResult {
  totalFound:    number;
  hasGraphData:  boolean;
  entries:       import('./repositories/memory-repository.ts').MemoryEntry[];
  summary:       string;
  graphEntities: GraphEntity[];
}

export async function buildMemoryContext(
  query:   string,
  options: { categories?: string[]; limit?: number; minScore?: number } = {},
): Promise<MemoryContextResult> {
  const entries = await _repo.search(query, options).catch(() => []);
  return {
    totalFound:    entries.length,
    hasGraphData:  false,
    entries,
    summary:       entries.map(e => e.content.slice(0, 80)).join(' | '),
    graphEntities: [],
  };
}

// ── buildMemoryContextString ──────────────────────────────────────────────────

export async function buildMemoryContextString(
  opts: { runId?: string; projectId?: string; query?: string } = {},
): Promise<string> {
  const query = opts.query
    ?? ([opts.runId && `run:${opts.runId}`, opts.projectId && `project:${opts.projectId}`]
         .filter(Boolean).join(' ') || 'general');
  const ctx = await buildMemoryContext(query, { limit: 5 }).catch(() => null);
  if (!ctx || ctx.totalFound === 0) return '';
  return ctx.entries
    .map(e => `[${e.category}] ${e.content.slice(0, 150)}`)
    .join('\n');
}

// ── graphStore / graphTraversal — backward-compat stubs ───────────────────────
// Knowledge graph was removed in this architecture. Stubs keep planner working.

export interface GraphEntity {
  id:          string;
  kind:        string;
  label:       string;
  description: string;
}

export const graphStore = {
  listEntities(): GraphEntity[] { return []; },
};

export const graphTraversal = {
  neighbours(_entityId: string): GraphEntity[] { return []; },
};
