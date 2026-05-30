/**
 * server/memory/core/memory-router.ts
 *
 * Purpose: Routes memory operations to the correct store.
 * Responsibility: Dispatch create/get/update/delete/search by category.
 *   Cross-category search aggregation.
 * Exports: MemoryRouter, memoryRouter (singleton)
 */

import type {
  MemoryEntry,
  MemoryCategory,
  CreateEntryInput,
  UpdateEntryPatch,
  MemoryFilter,
} from '../types/memory.types.ts';
import type { SearchQuery, RankedResult } from '../types/search.types.ts';
import { memoryRegistry }  from './memory-registry.ts';

// ── Router ────────────────────────────────────────────────────────────────────

export class MemoryRouter {

  async create(input: CreateEntryInput): Promise<MemoryEntry> {
    const store = memoryRegistry.get(input.category);
    return store.create(input);
  }

  async get(category: MemoryCategory, id: string): Promise<MemoryEntry | undefined> {
    const store = memoryRegistry.get(category);
    return store.get(id);
  }

  async update(
    category: MemoryCategory,
    id:       string,
    patch:    UpdateEntryPatch,
  ): Promise<MemoryEntry | undefined> {
    const store = memoryRegistry.get(category);
    return store.update(id, patch);
  }

  async delete(category: MemoryCategory, id: string): Promise<boolean> {
    const store = memoryRegistry.get(category);
    return store.delete(id);
  }

  async list(category: MemoryCategory, filter?: MemoryFilter): Promise<MemoryEntry[]> {
    const store = memoryRegistry.get(category);
    return store.list(filter);
  }

  async search(category: MemoryCategory, query: string, limit?: number): Promise<MemoryEntry[]> {
    const store = memoryRegistry.get(category);
    return store.search(query, limit);
  }

  /**
   * Search across all registered categories (or a subset) and return
   * a merged, score-sorted result list.
   */
  async searchAll(query: SearchQuery): Promise<RankedResult[]> {
    const categories = query.categories ?? memoryRegistry.categories();
    const limit      = query.limit ?? 20;

    const perStoreLimit = Math.min(limit * 2, 50);
    const all: RankedResult[] = [];

    await Promise.all(
      categories.map(async (cat) => {
        if (!memoryRegistry.has(cat)) return;
        const store   = memoryRegistry.get(cat);
        const entries = await store.search(query.text, perStoreLimit);
        for (const entry of entries) {
          all.push({
            entry,
            relevance:     entry.score,
            matchedTerms:  [],
            retrievalMode: query.mode ?? 'semantic',
          });
        }
      }),
    );

    return all
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  async count(category: MemoryCategory): Promise<number> {
    const store = memoryRegistry.get(category);
    return store.count();
  }

  async countAll(): Promise<number> {
    const counts = await Promise.all(
      memoryRegistry.all().map(s => s.count()),
    );
    return counts.reduce((sum, n) => sum + n, 0);
  }
}

export const memoryRouter = new MemoryRouter();
