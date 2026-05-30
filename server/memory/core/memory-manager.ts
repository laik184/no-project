/**
 * server/memory/core/memory-manager.ts
 *
 * Purpose: Lifecycle management for the memory platform.
 * Responsibility: Boot sequence, TTL eviction scheduling, graceful shutdown.
 * Exports: MemoryManager, memoryManager (singleton)
 */

import { memoryRegistry }   from './memory-registry.ts';
import type { BaseMemoryStore } from './memory-store.ts';
import type { MemoryEntry }     from '../types/memory.types.ts';

// ── Manager ───────────────────────────────────────────────────────────────────

export class MemoryManager {
  private evictionTimer: ReturnType<typeof setInterval> | null = null;
  private booted = false;

  /**
   * Boot the memory platform.
   * Schedules periodic TTL eviction across all registered stores.
   */
  boot(evictionIntervalMs = 60_000): void {
    if (this.booted) return;
    this.booted = true;

    this.evictionTimer = setInterval(() => {
      this.runEviction();
    }, evictionIntervalMs);

    // Prevent the timer from blocking process exit
    if (this.evictionTimer.unref) this.evictionTimer.unref();

    console.log(`[memory-manager] Booted — eviction every ${evictionIntervalMs}ms`);
  }

  /** Gracefully stop the memory manager. */
  shutdown(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    this.booted = false;
    console.log('[memory-manager] Shutdown complete');
  }

  /** Run TTL eviction on all stores that support it. */
  runEviction(): number {
    let total = 0;
    for (const store of memoryRegistry.all()) {
      const s = store as unknown as BaseMemoryStore<MemoryEntry>;
      if (typeof s.evictStale === 'function') {
        total += s.evictStale();
      }
    }
    return total;
  }

  isBooted(): boolean {
    return this.booted;
  }
}

export const memoryManager = new MemoryManager();
