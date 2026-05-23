/**
 * deterministic-write-coordinator.ts
 *
 * Top-level coordinator that exposes the canonical write entry point for
 * the entire memory infrastructure.
 *
 * Single responsibility: route write requests into the queue lane manager
 * after emitting bridge telemetry.
 *
 * This is the ONLY public API callers outside the quantum/memory module
 * should use for all file memory writes.
 *
 * Architecture:
 *   deterministicWriteCoordinator.enqueue(params)
 *     → memoryTelemetryBridge.enqueue()     (telemetry)
 *     → QueueLaneManager.push()             (FIFO lane)
 *     → QueueBackpressureGuard.evaluate()   (depth gate)
 *     → executeQueueEntry()                 (dispatcher)
 *     → SafeWritePolicyEngine.evaluate()    (policy gate)
 *     → MemoryOwnershipRegistry.verify()    (ownership gate)
 *     → executeTransaction()                (atomic write)
 *     → memoryTelemetryBridge.commit()      (telemetry)
 */

import { QueueLaneManager }        from "./queue-core.ts";
import { queueHealthMonitor }      from "./queue-health-monitor.ts";
import { memoryTelemetryBridge }   from "./memory-telemetry-bridge.ts";
import type { QueueKey, WriteResult } from "./memory-types.ts";
import type { MemoryFileType }     from "./memory-types.ts";
import type { QueueStats }         from "./memory-types.ts";
import { v4 as uuid }              from "uuid";

// ── Public params ─────────────────────────────────────────────────────────────

export interface CoordinatorEnqueueParams {
  queueKey:    QueueKey;
  filePath:    string;
  content?:    string;
  mutator?:    (current: string) => string | Promise<string>;
  fileType:    MemoryFileType;
  ownerId:     string;
  runId?:      string;
  maxRetries?: number;
  timeoutMs?:  number;
  signal?:     AbortSignal;
}

// ── Coordinator ───────────────────────────────────────────────────────────────

class DeterministicWriteCoordinator {
  private readonly _laneManager = new QueueLaneManager();

  constructor() {
    // Attach health monitor to our lane manager
    queueHealthMonitor.attach(this._laneManager);
    queueHealthMonitor.start();
  }

  /**
   * Enqueue a memory write.
   * Resolves when the write is committed; rejects on permanent failure.
   */
  enqueue(params: CoordinatorEnqueueParams): Promise<WriteResult> {
    if (!params.content && !params.mutator) {
      return Promise.reject(
        new Error("[DeterministicWriteCoordinator] enqueue() requires `content` or `mutator`"),
      );
    }

    const requestId = uuid();
    const runId     = params.runId ?? "system";

    // Emit bridge telemetry before touching the queue
    memoryTelemetryBridge.enqueue(requestId, params.filePath, params.ownerId, runId, String(params.queueKey));

    return new Promise<WriteResult>((resolve, reject) => {
      this._laneManager.push(params.queueKey, {
        request: {
          id:         requestId,
          queueKey:   params.queueKey,
          filePath:   params.filePath,
          content:    params.content,
          mutator:    params.mutator,
          fileType:   params.fileType,
          ownerId:    params.ownerId,
          runId,
          maxRetries: params.maxRetries  ?? 3,
          timeoutMs:  params.timeoutMs   ?? 30_000,
          enqueuedAt: Date.now(),
          signal:     params.signal,
        },
        resolve,
        reject,
      });
    });
  }

  /** All-lane stats snapshot. */
  stats(): QueueStats[] {
    return this._laneManager.allStats();
  }

  /** Single-lane stats; null if the lane has never been used. */
  laneStats(queueKey: QueueKey): QueueStats | null {
    return this._laneManager.laneStats(queueKey);
  }

  /** Force a health scan immediately. */
  healthSnapshot() {
    return queueHealthMonitor.scan();
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const deterministicWriteCoordinator = new DeterministicWriteCoordinator();
