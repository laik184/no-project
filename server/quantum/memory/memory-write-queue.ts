/**
 * memory-write-queue.ts  (facade — ≤250 lines)
 *
 * THE canonical write entry point for all memory file mutations.
 * All callers must route through `memoryWriteQueue.enqueue(...)`.
 *
 * This file is now a thin facade over the decomposed modules:
 *   queue-core.ts          — lane management + FIFO drain
 *   queue-dispatcher.ts    — entry execution + retry
 *   queue-backpressure.ts  — depth-based throttle/block gate
 *   queue-retry-policy.ts  — delay computation
 *   safe-write-policy.ts   — pre-write safety checks
 *   memory-ownership-registry.ts — ownership verification
 *
 * Architecture guarantee:
 *   User Request
 *     → memoryWriteQueue.enqueue()
 *     → DeterministicWriteCoordinator
 *     → QueueLaneManager (FIFO lane)
 *     → QueueBackpressureGuard (depth gate)
 *     → executeQueueEntry (dispatcher)
 *     → SafeWritePolicyEngine (policy gate)
 *     → MemoryOwnershipRegistry (ownership gate)
 *     → executeTransaction (atomic write)
 *     → MemoryTelemetryBridge (telemetry)
 *     → Commit / Rollback
 */

import { deterministicWriteCoordinator } from "./deterministic-write-coordinator.ts";
import { memoryOwnershipRegistry }       from "./memory-ownership-registry.ts";
import type { QueueKey, WriteResult, MemoryFileType, QueueStats } from "./memory-types.ts";

// ── Enqueue params (public contract) ─────────────────────────────────────────

export interface EnqueueParams {
  /** Isolated lane — use String(projectId) or sandboxPath. */
  queueKey:    QueueKey;
  /** Absolute file path to write. */
  filePath:    string;
  /** Static replacement content. Mutually exclusive with `mutator`. */
  content?:    string;
  /**
   * Read-modify-write function. Receives the current file content
   * (empty string when file doesn't exist) and returns the new content.
   * Executed inside the exclusive lock — safe against concurrent callers.
   */
  mutator?:    (current: string) => string | Promise<string>;
  /** File format — drives the validator. */
  fileType:    MemoryFileType;
  /** Logical owner name (e.g. "memory-store"). */
  ownerId:     string;
  /** Active agent run id, or "system". */
  runId?:      string;
  /** Override default retry count. */
  maxRetries?: number;
  /** Override default timeout (ms). */
  timeoutMs?:  number;
  /** Optional cancellation signal. */
  signal?:     AbortSignal;
}

// ── Facade ────────────────────────────────────────────────────────────────────

class MemoryWriteQueueManager {
  /**
   * Enqueue a memory write.
   * Resolves when the write is committed; rejects on permanent failure.
   *
   * All callers MUST use this method — direct file I/O outside this queue
   * is a safety violation and will cause memory corruption under parallelism.
   */
  enqueue(params: EnqueueParams): Promise<WriteResult> {
    if (!params.content && !params.mutator) {
      return Promise.reject(
        new Error("[MemoryWriteQueue] enqueue() requires either `content` or `mutator`"),
      );
    }

    const runId = params.runId ?? "system";

    // Auto-claim ownership for callers that don't pre-claim
    // (system writes, memory-store, etc. are auto-approved by the registry)
    memoryOwnershipRegistry.claim({
      ownerId:  params.ownerId,
      runId,
      filePath: params.filePath,
      queueKey: params.queueKey,
      ttlMs:    (params.timeoutMs ?? 30_000) + 10_000,
    });

    return deterministicWriteCoordinator.enqueue({
      queueKey:   params.queueKey,
      filePath:   params.filePath,
      content:    params.content,
      mutator:    params.mutator,
      fileType:   params.fileType,
      ownerId:    params.ownerId,
      runId,
      maxRetries: params.maxRetries,
      timeoutMs:  params.timeoutMs,
      signal:     params.signal,
    });
  }

  /** Snapshot of all active queue states. */
  stats(): QueueStats[] {
    return deterministicWriteCoordinator.stats();
  }

  /** Stats for a single lane. Returns null if the lane has never been used. */
  laneStats(queueKey: QueueKey): QueueStats | null {
    return deterministicWriteCoordinator.laneStats(queueKey);
  }

  /** Force an immediate health scan of all queue lanes. */
  healthSnapshot() {
    return deterministicWriteCoordinator.healthSnapshot();
  }

  /**
   * Revoke all ownership tokens for a finished run.
   * Call after every run completion (success or failure).
   */
  revokeRun(runId: string): void {
    memoryOwnershipRegistry.revokeRun(runId);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const memoryWriteQueue = new MemoryWriteQueueManager();
