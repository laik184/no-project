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
import { chunkCode, chunkJson, chunkMarkdown, chunkText } from '../chunking/index.ts';

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

function inferContentType(input: SaveInput): 'code' | 'json' | 'markdown' | 'text' {
  const explicit = String(input.meta?.['contentType'] ?? input.meta?.['type'] ?? '').toLowerCase();
  const path     = String(input.meta?.['filePath'] ?? input.meta?.['path'] ?? '').toLowerCase();

  if (explicit.includes('json') || path.endsWith('.json')) return 'json';
  if (explicit.includes('markdown') || explicit === 'md' || path.endsWith('.md') || path.endsWith('.mdx')) return 'markdown';
  if (
    explicit.includes('code')
    || /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|cs|cpp|c|h|css|scss|html|sql)$/.test(path)
  ) return 'code';

  return 'text';
}

function chunkMemoryContent(input: SaveInput): string[] {
  const contentType = inferContentType(input);

  if (contentType === 'json') {
    try {
      return chunkJson(JSON.parse(input.content));
    } catch {
      return chunkText(input.content, { chunkSize: 900, overlap: 120 });
    }
  }

  if (contentType === 'markdown') return chunkMarkdown(input.content, { maxChunkSize: 900, overlap: 120 });
  if (contentType === 'code') return chunkCode(input.content, { maxChunkSize: 1200 });
  return chunkText(input.content, { chunkSize: 900, overlap: 120 });
}

class MemoryRepository {
  private hydrated = false;

  async init(): Promise<void> {
    if (this.hydrated) return;
    await hydrateVectorStore();
    this.hydrated = true;
  }

  async save(input: SaveInput): Promise<MemoryEntry> {
    await this.init();
    const parentId = crypto.randomUUID();
    const chunks   = chunkMemoryContent(input);
    const parts    = chunks.length > 0 ? chunks : [input.content];

    const entry: MemoryEntry = {
      id:        parentId,
      category:  input.category,
      content:   input.content,
      tags:      input.tags  ?? [],
      score:     input.score ?? 1.0,
      meta:      { ...(input.meta ?? {}), chunkCount: parts.length },
      createdAt: Date.now(),
    };

    for (let i = 0; i < parts.length; i++) {
      const chunkEntry: MemoryEntry = {
        ...entry,
        id:      parts.length === 1 ? parentId : `${parentId}:chunk:${i}`,
        content: parts[i],
        meta:    {
          ...entry.meta,
          parentId,
          chunkIndex: i,
          chunkCount: parts.length,
          contentType: inferContentType(input),
        },
      };

      const vector = await embeddingService.embed(chunkEntry.content);
      upsertVector({ id: chunkEntry.id, vector, metadata: chunkEntry as unknown as Record<string, unknown> });
    }

    await persistVectorStore();
    return entry;
  }

  async search(query: string, options: SearchOptions = {}): Promise<MemoryEntry[]> {
    await this.init();
    const { categories, limit = 10, minScore = 0 } = options;

    const filter = categories && categories.length > 0
      ? (r: VectorRecord) => categories.includes(String(r.metadata['category'] ?? ''))
      : undefined;

    const raw      = await hybridSearch(query, limit * 4, 0.7, filter);
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
