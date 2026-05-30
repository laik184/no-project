/**
 * server/memory/core/memory-engine.ts
 *
 * Purpose: Unified public API surface for the entire memory platform.
 * Responsibility: Facade over router, registry, and retrieval engine.
 *   The single import point for external consumers (agents, orchestration).
 * Exports: MemoryEngine, memoryEngine (singleton)
 */

import type {
  MemoryEntry,
  MemoryCategory,
  CreateEntryInput,
  UpdateEntryPatch,
  MemoryFilter,
} from '../types/memory.types.ts';
import type { SearchQuery, SearchResult, RankedResult } from '../types/search.types.ts';
import { memoryRouter }    from './memory-router.ts';
import { memoryRegistry }  from './memory-registry.ts';

// ── Engine ────────────────────────────────────────────────────────────────────

export class MemoryEngine {

  // ── Store operations ──────────────────────────────────────────────────────

  async store(input: CreateEntryInput): Promise<MemoryEntry> {
    return memoryRouter.create(input);
  }

  async retrieve(category: MemoryCategory, id: string): Promise<MemoryEntry | undefined> {
    return memoryRouter.get(category, id);
  }

  async update(
    category: MemoryCategory,
    id:       string,
    patch:    UpdateEntryPatch,
  ): Promise<MemoryEntry | undefined> {
    return memoryRouter.update(category, id, patch);
  }

  async forget(category: MemoryCategory, id: string): Promise<boolean> {
    return memoryRouter.delete(category, id);
  }

  async list(category: MemoryCategory, filter?: MemoryFilter): Promise<MemoryEntry[]> {
    return memoryRouter.list(category, filter);
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async search(query: SearchQuery): Promise<SearchResult> {
    const start   = Date.now();
    const results = await memoryRouter.searchAll(query);
    return {
      query,
      results,
      totalFound:  results.length,
      durationMs:  Date.now() - start,
    };
  }

  async searchCategory(
    category: MemoryCategory,
    text:     string,
    limit?:   number,
  ): Promise<MemoryEntry[]> {
    return memoryRouter.search(category, text, limit);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  async totalCount(): Promise<number> {
    return memoryRouter.countAll();
  }

  async categoryCount(category: MemoryCategory): Promise<number> {
    return memoryRouter.count(category);
  }

  registeredCategories(): MemoryCategory[] {
    return memoryRegistry.categories();
  }
}

export const memoryEngine = new MemoryEngine();
