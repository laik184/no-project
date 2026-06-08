/**
 * preview-cache.ts — TTL-based in-memory cache for preview data.
 * Used for expensive-to-compute values (e.g., health checks).
 * Redis adapter interface stubbed for future compatibility.
 */

interface CacheEntry<T> {
  value:     T;
  expiresAt: number;
}

class PreviewCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  size(): number {
    return this.store.size;
  }
}

export const previewCache = new PreviewCache();

// ── Cache key helpers ─────────────────────────────────────────────────────────

export const CacheKey = {
  health:  (projectId: number) => `health:${projectId}`,
  state:   (projectId: number) => `state:${projectId}`,
  session: (sessionId: string) => `session:${sessionId}`,
} as const;

// ── TTL constants (ms) ────────────────────────────────────────────────────────

export const TTL = {
  HEALTH:  5_000,   // 5 s
  STATE:   2_000,   // 2 s
  SESSION: 30_000,  // 30 s
} as const;
