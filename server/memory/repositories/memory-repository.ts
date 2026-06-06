/**
 * server/memory/repositories/memory-repository.ts
 *
 * Persistent memory repository.
 *   save()   → embed → upsert → persist (fire-and-forget)
 *   search() → embed → hybrid search → rerank → return
 *
 * Import chain: repositories → persistence, retrieval, embedding, vector (all allowed)
 */

import crypto                          from 'node:crypto';
import { embeddingService }            from '../embedding/embedding-service.ts';
import { upsertVector, deleteVector }  from '../vector/vector-upsert.ts';
import { vectorStore }                 from '../vector/vector-store.ts';
import { hydrateVectorStore, persistVectorStore } from '../persistence/vector-store-adapter.ts';
import { hybridSearch }                from '../retrieval/hybrid-retrieval.ts';
import { rerank }                      from '../retrieval/reranker.ts';
import type { VectorRecord }           from '../vector/vector-store.ts';

export interface MemoryEntry {
  id:        string;
  category:  string;
  content:   string;
  tags:      string[];
  score:     number;
  meta:      Record<string, unknown>;
  createdAt: number;
}

export interface SaveInput {
  category: string;
  content:  string;
  tags?:    string[];
  score?:   number;
  meta?:    Record<string, unknown>;
}

export interface SearchOptions {
  categories?: string[];
  limit?:      number;
  minScore?:   number;
}

class MemoryRepository {
  private hydrated = false;

  async init(): Promise<void> {
    if (this.hydrated) return;
    await hydrateVectorStore();
    this.hydrated = true;
  }

  async save(input: SaveInput): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id:        crypto.randomUUID(),
      category:  input.category,
      content:   input.content,
      tags:      input.tags  ?? [],
      score:     input.score ?? 1.0,
      meta:      input.meta  ?? {},
      createdAt: Date.now(),
    };

    const vector = await embeddingService.embed(input.content);
    upsertVector({ id: entry.id, vector, metadata: entry as unknown as Record<string, unknown> });
    persistVectorStore().catch(console.error);
    return entry;
  }

  async search(query: string, options: SearchOptions = {}): Promise<MemoryEntry[]> {
    await this.init();
    const { categories, limit = 10, minScore = 0 } = options;

    const filter = categories && categories.length > 0
      ? (r: VectorRecord) => categories.includes(String(r.metadata['category'] ?? ''))
      : undefined;

    const raw      = await hybridSearch(query, limit * 2);
    const filtered = filter ? raw.filter(r => filter({ id: r.id, vector: [], metadata: r.metadata })) : raw;
    const ranked   = rerank(filtered, query, { minScore });

    return ranked
      .slice(0, limit)
      .map(r => r.metadata as unknown as MemoryEntry);
  }

  async searchByCategory(category: string, query: string, limit: number = 10): Promise<MemoryEntry[]> {
    return this.search(query, { categories: [category], limit });
  }

  async delete(id: string): Promise<boolean> {
    const ok = deleteVector(id);
    if (ok) persistVectorStore().catch(console.error);
    return ok;
  }

  getById(id: string): MemoryEntry | undefined {
    const record = vectorStore.get(id);
    return record ? (record.metadata as unknown as MemoryEntry) : undefined;
  }
}

export const memoryRepository = new MemoryRepository();
