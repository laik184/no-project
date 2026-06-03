/**
 * server/file-explorer/repositories/metadata.repository.ts
 * In-memory LRU-style cache for file metadata (stat + computed fields).
 * Invalidated whenever a file mutation occurs.
 */

import type { FileStat } from '../../../shared/file-explorer-core/types/index.ts';

const MAX_CACHE = 512;

interface CachedMeta {
  stat:      FileStat;
  cachedAt:  number;
}

class MetadataRepository {
  private readonly cache = new Map<string, CachedMeta>();

  get(absPath: string): FileStat | undefined {
    return this.cache.get(absPath)?.stat;
  }

  set(absPath: string, stat: FileStat): void {
    if (this.cache.size >= MAX_CACHE) {
      // Evict oldest entry
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(absPath, { stat, cachedAt: Date.now() });
  }

  /** Invalidates a specific path and any path that starts with it (folder invalidation). */
  invalidate(absPath: string): void {
    for (const key of this.cache.keys()) {
      if (key === absPath || key.startsWith(absPath + '/') || key.startsWith(absPath + '\\')) {
        this.cache.delete(key);
      }
    }
  }

  /** Clears the entire cache. */
  clear(): void {
    this.cache.clear();
  }
}

export const metadataRepository = new MetadataRepository();
