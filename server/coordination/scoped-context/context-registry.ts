/**
 * context-registry.ts
 *
 * In-process registry for active CoordinationContexts.
 * Single responsibility: context lookup + lifecycle tracking.
 *
 * Design rules:
 * - One context per runId; re-registration replaces existing.
 * - Stale entries are evicted after TTL_MS (default 30 min).
 * - Never stores sensitive execution data — only the context reference.
 */

import type { CoordinationContext } from "../contracts/coordination.contracts.ts";

const TTL_MS = 30 * 60 * 1_000; // 30 minutes

interface RegistryEntry {
  ctx:         CoordinationContext;
  registeredAt: number;
}

// ── Registry ──────────────────────────────────────────────────────────────────

class ContextRegistry {
  private readonly store = new Map<string, RegistryEntry>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /** Register a context. Replaces any existing context for the same runId. */
  register(ctx: CoordinationContext): void {
    this.store.set(ctx.runId, { ctx, registeredAt: Date.now() });
  }

  /** Remove a context by runId. */
  unregister(runId: string): void {
    this.store.delete(runId);
  }

  // ── Lookup ──────────────────────────────────────────────────────────────────

  get(runId: string): CoordinationContext | undefined {
    const entry = this.store.get(runId);
    if (!entry) return undefined;
    // Evict stale entries on read
    if (Date.now() - entry.registeredAt > TTL_MS) {
      this.store.delete(runId);
      return undefined;
    }
    return entry.ctx;
  }

  has(runId: string): boolean {
    return this.get(runId) !== undefined;
  }

  /** All currently active (non-stale) contexts. */
  getAll(): CoordinationContext[] {
    const now = Date.now();
    const result: CoordinationContext[] = [];
    for (const [runId, entry] of this.store) {
      if (now - entry.registeredAt > TTL_MS) {
        this.store.delete(runId);
      } else {
        result.push(entry.ctx);
      }
    }
    return result;
  }

  count(): number {
    return this.getAll().length;
  }

  // ── Background sweeper ──────────────────────────────────────────────────────

  startSweeper(intervalMs = 5 * 60 * 1_000): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), intervalMs);
  }

  stopSweeper(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  private sweep(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [runId, entry] of this.store) {
      if (now - entry.registeredAt > TTL_MS) {
        this.store.delete(runId);
        evicted++;
      }
    }
    if (evicted > 0) {
      console.log(`[context-registry] Evicted ${evicted} stale context(s). Active: ${this.store.size}`);
    }
  }
}

export const contextRegistry = new ContextRegistry();
