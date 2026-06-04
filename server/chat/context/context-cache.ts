import type { ChatMessageRecord } from '../types/message.types.ts';
import type { ChatRun } from '../types/run.types.ts';

export interface LoadedContext {
  messages: ChatMessageRecord[];
  run:      ChatRun | null;
}

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value:     LoadedContext;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

export const contextCache = {
  get(key: string): LoadedContext | null {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
    return entry.value;
  },

  set(key: string, value: LoadedContext): void {
    _cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  },

  delete(key: string): void {
    _cache.delete(key);
  },

  clear(): void {
    _cache.clear();
  },
};
