/**
 * server/verification/typescript/verification-cache.ts
 *
 * VerificationCache — safe, deterministic caching of PASSED results only.
 * FAILED results are NEVER cached. Cache key is derived from immutable inputs.
 * TTL-based invalidation. No stale-while-revalidate.
 */

import type { CacheEntry, VerificationResult } from "./types.ts";

const DEFAULT_TTL_MS = 30_000; // 30 seconds
const MAX_ENTRIES = 100;

export interface CacheKey {
  readonly tsconfigHash: string;
  readonly workspaceChecksum: string;
}

export class VerificationCache {
  private _store = new Map<string, CacheEntry>();

  buildKey(ck: CacheKey): string {
    return `${ck.tsconfigHash}:${ck.workspaceChecksum}`;
  }

  get(key: string): VerificationResult | null {
    const entry = this._store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.storedAt + entry.ttlMs) {
      this._store.delete(key);
      return null;
    }

    return entry.result;
  }

  set(key: string, result: VerificationResult, ttlMs = DEFAULT_TTL_MS): void {
    // CRITICAL: only cache PASSED results
    if (!result.passed) return;

    this._evict();

    const entry: CacheEntry = Object.freeze({
      key,
      result,
      storedAt: Date.now(),
      ttlMs,
    });

    this._store.set(key, entry);
  }

  invalidate(key: string): void {
    this._store.delete(key);
  }

  invalidateAll(): void {
    this._store.clear();
  }

  invalidateByWorkspace(workspacePath: string): void {
    for (const [key, entry] of this._store.entries()) {
      if (entry.result.workspacePath === workspacePath) {
        this._store.delete(key);
      }
    }
  }

  size(): number {
    this._evictExpired();
    return this._store.size;
  }

  private _evict(): void {
    if (this._store.size < MAX_ENTRIES) return;
    // Remove oldest entry by storedAt
    let oldest: string | null = null;
    let oldestTs = Infinity;
    for (const [key, entry] of this._store.entries()) {
      if (entry.storedAt < oldestTs) {
        oldestTs = entry.storedAt;
        oldest = key;
      }
    }
    if (oldest) this._store.delete(oldest);
  }

  private _evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this._store.entries()) {
      if (now > entry.storedAt + entry.ttlMs) {
        this._store.delete(key);
      }
    }
  }
}

// ─── Process-scoped singleton ──────────────────────────────────────────────────

export const verificationCache = new VerificationCache();
