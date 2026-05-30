/**
 * server/memory/core/memory-registry.ts
 *
 * Purpose: Central registry for all memory stores.
 * Responsibility: Register, retrieve, and enumerate stores by category.
 * Exports: MemoryRegistry, memoryRegistry (singleton)
 */

import type { MemoryStore, MemoryEntry, MemoryCategory } from '../types/memory.types.ts';

// ── Registry ──────────────────────────────────────────────────────────────────

export class MemoryRegistry {
  private readonly stores = new Map<MemoryCategory, MemoryStore<MemoryEntry>>();

  register<T extends MemoryEntry>(store: MemoryStore<T>): void {
    if (this.stores.has(store.category)) {
      throw new Error(`[memory-registry] Store already registered: "${store.category}"`);
    }
    this.stores.set(store.category, store as MemoryStore<MemoryEntry>);
  }

  get<T extends MemoryEntry>(category: MemoryCategory): MemoryStore<T> {
    const store = this.stores.get(category);
    if (!store) {
      throw new Error(`[memory-registry] No store registered for category: "${category}"`);
    }
    return store as MemoryStore<T>;
  }

  has(category: MemoryCategory): boolean {
    return this.stores.has(category);
  }

  all(): MemoryStore<MemoryEntry>[] {
    return [...this.stores.values()];
  }

  categories(): MemoryCategory[] {
    return [...this.stores.keys()];
  }

  size(): number {
    return this.stores.size;
  }
}

export const memoryRegistry = new MemoryRegistry();
