/**
 * context-cache.ts — Short-lived in-memory cache for loaded context.
 * TTL-based eviction — prevents redundant DB reads within a single turn.
 */
import type { LoadedContext } from './context-loader.ts';

const TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  value:     LoadedContext;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of _cache) {
    if (entry.expiresAt <= now) _cache.delete(key);
  }
}

export const contextCache = {
  get(key: string): LoadedContext | null {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      _cache.delete(key);
      return null;
    }
    return entry.value;
  },

  set(key: string, value: LoadedContext): void {
    evictExpired();
    _cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  },

  delete(key: string): void {
    _cache.delete(key);
  },

  size(): number {
    evictExpired();
    return _cache.size;
  },

  clear(): void {
    _cache.clear();
  },
};
