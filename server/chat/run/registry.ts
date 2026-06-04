/**
 * server/chat/run/registry.ts
 *
 * Per-run chat state cleanup registry.
 *
 * Called by server/infrastructure/memory/run-cleanup-manager.ts during the
 * replay-safe eviction cycle. Cleans up all in-memory chat state associated
 * with a run so memory is not held beyond the replay window.
 *
 * Ownership: this file coordinates cleanup across chat module sub-systems.
 * It does NOT own any state — each sub-system owns and clears its own state.
 */

import { questionManager } from '../questions/question-manager.ts';
import { contextCache }    from '../context/context-cache.ts';
import { eventTimeline }   from '../timeline/event-timeline.ts';
import { turnManager, streamManager } from '../../services/chat/index.ts';

/**
 * Release all per-run in-memory chat state.
 * Called by run-cleanup-manager after the replay TTL expires.
 *
 * Safe to call multiple times — each sub-system is idempotent on clear.
 */
export function unregisterRun(runId: string): void {
  // Cancel any pending questions for this run
  questionManager.cancelByRun(runId);

  // Evict context cache entry
  contextCache.delete(runId);

  // Clear timeline entries
  eventTimeline.clear(runId);

  // Close any lingering stream (no-op if already closed)
  if (streamManager.isActive(runId)) {
    streamManager.close(runId);
  }

  // Clear completed/failed turns
  turnManager.clearCompleted();
}
