/**
 * memory-write-queue.ts
 *
 * Serialized, per-project write queue for all memory file mutations.
 *
 * ONLY this module may execute memory file writes.
 * All callers must route through `memoryWriteQueue.enqueue(...)`.
 *
 * Architecture:
 *   Map<QueueKey, ProjectWriteQueue>
 *   — one isolated FIFO lane per project / sandbox path
 *   — strict serial execution within each lane
 *   — concurrent lanes for different projects (no global bottleneck)
 *
 * Per-write guarantees:
 *   ✅ FIFO ordering within a lane
 *   ✅ atomic execution via memory-transaction.ts
 *   ✅ retry with exponential back-off
 *   ✅ per-write timeout enforcement
 *   ✅ cancellation via AbortSignal
 *   ✅ telemetry on every state transition
 */

import { v4 as uuid } from "uuid";

import { executeTransaction }   from "./memory-transaction.ts";
import {
  emitWriteStarted, emitWriteCompleted, emitWriteFailed, emitRetry,
} from "./memory-telemetry.ts";
import type {
  QueueKey, WriteRequest, WriteResult,
  QueueEntry, ProjectWriteQueue, QueueStats,
  MemoryFileType,
} from "./memory-types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_RETRIES  = 3;
const DEFAULT_TIMEOUT_MS   = 30_000;
const RETRY_BASE_DELAY_MS  = 200;
const RETRY_MAX_DELAY_MS   = 5_000;

// ── Enqueue parameters ────────────────────────────────────────────────────────

export interface EnqueueParams {
  /** Isolated lane — use String(projectId) or sandboxPath. */
  queueKey:    QueueKey;
  /** Absolute file path to write. */
  filePath:    string;
  /** Static replacement content.  Mutually exclusive with `mutator`. */
  content?:    string;
  /**
   * Read-modify-write function. Receives the current file content
   * (empty string when file doesn't exist) and returns the new content.
   * Executes inside the exclusive lock — safe against concurrent callers.
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

// ── Queue class ───────────────────────────────────────────────────────────────

class MemoryWriteQueueManager {
  private readonly lanes = new Map<QueueKey, ProjectWriteQueue>();

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Enqueue a memory write.
   * Resolves when the write is committed; rejects on permanent failure.
   */
  enqueue(params: EnqueueParams): Promise<WriteResult> {
    if (!params.content && !params.mutator) {
      return Promise.reject(
        new Error("enqueue() requires either `content` or `mutator`"),
      );
    }

    const request: WriteRequest = {
      id:          uuid(),
      queueKey:    params.queueKey,
      filePath:    params.filePath,
      content:     params.content,
      mutator:     params.mutator,
      fileType:    params.fileType,
      ownerId:     params.ownerId,
      runId:       params.runId ?? "system",
      maxRetries:  params.maxRetries  ?? DEFAULT_MAX_RETRIES,
      timeoutMs:   params.timeoutMs   ?? DEFAULT_TIMEOUT_MS,
      enqueuedAt:  Date.now(),
      signal:      params.signal,
    };

    return new Promise<WriteResult>((resolve, reject) => {
      const lane = this.getOrCreateLane(request.queueKey);
      lane.pending.push({ request, resolve, reject });
      this.drain(request.queueKey);
    });
  }

  /** Snapshot of all active queue states. */
  stats(): QueueStats[] {
    return Array.from(this.lanes.entries()).map(([queueKey, lane]) => ({
      queueKey,
      depth:          lane.pending.length,
      active:         lane.active,
      processedTotal: lane.processedTotal,
      failedTotal:    lane.failedTotal,
      lastActivityTs: lane.lastActivityTs,
    }));
  }

  /** Stats for a single lane. Returns null if the lane has never been used. */
  laneStats(queueKey: QueueKey): QueueStats | null {
    const lane = this.lanes.get(queueKey);
    if (!lane) return null;
    return {
      queueKey,
      depth:          lane.pending.length,
      active:         lane.active,
      processedTotal: lane.processedTotal,
      failedTotal:    lane.failedTotal,
      lastActivityTs: lane.lastActivityTs,
    };
  }

  // ── Private: lane management ───────────────────────────────────────────────

  private getOrCreateLane(queueKey: QueueKey): ProjectWriteQueue {
    let lane = this.lanes.get(queueKey);
    if (!lane) {
      lane = {
        active:          false,
        pending:         [],
        processedTotal:  0,
        failedTotal:     0,
        lastActivityTs:  Date.now(),
      };
      this.lanes.set(queueKey, lane);
    }
    return lane;
  }

  // ── Private: FIFO drain ────────────────────────────────────────────────────

  private drain(queueKey: QueueKey): void {
    const lane = this.lanes.get(queueKey);
    if (!lane || lane.active || lane.pending.length === 0) return;

    lane.active = true;
    const entry = lane.pending.shift()!;

    this.executeEntry(entry)
      .then(result => {
        lane.processedTotal++;
        lane.lastActivityTs = Date.now();
        entry.resolve(result);
      })
      .catch(err => {
        lane.failedTotal++;
        lane.lastActivityTs = Date.now();
        entry.reject(err as Error);
      })
      .finally(() => {
        lane.active = false;
        // Schedule next item without growing the call stack
        setImmediate(() => this.drain(queueKey));
      });
  }

  // ── Private: execute one entry with retry + timeout ───────────────────────

  private async executeEntry(entry: QueueEntry): Promise<WriteResult> {
    const { request } = entry;
    const deadline    = request.enqueuedAt + request.timeoutMs;
    let   lastError   = "";

    emitWriteStarted(request.id, request.filePath, request.ownerId, request.runId, request.fileType);

    for (let attempt = 0; attempt <= request.maxRetries; attempt++) {
      // Honour cancellation
      if (request.signal?.aborted) {
        const err = "Write cancelled via AbortSignal";
        emitWriteFailed(request.id, request.filePath, request.ownerId, request.runId, elapsed(request), attempt, err);
        throw new Error(err);
      }

      // Honour deadline
      if (Date.now() > deadline) {
        const err = `Write timed out after ${request.timeoutMs}ms`;
        emitWriteFailed(request.id, request.filePath, request.ownerId, request.runId, elapsed(request), attempt, err);
        throw new Error(err);
      }

      // Retry telemetry (not emitted for attempt 0)
      if (attempt > 0) {
        emitRetry(request.id, request.filePath, request.ownerId, request.runId, attempt, lastError);
        await sleep(retryDelay(attempt));
      }

      try {
        const txResult = await executeTransaction({
          requestId: request.id,
          filePath:  request.filePath,
          content:   request.content,
          mutator:   request.mutator,
          fileType:  request.fileType,
          ownerId:   request.ownerId,
          runId:     request.runId,
        });

        const result: WriteResult = {
          success:    true,
          requestId:  request.id,
          filePath:   request.filePath,
          durationMs: elapsed(request),
          retries:    attempt,
          checksum:   txResult.checksum,
        };

        emitWriteCompleted(
          request.id, request.filePath, request.ownerId, request.runId,
          result.durationMs, attempt, txResult.checksum,
        );

        return result;

      } catch (err) {
        lastError = (err as Error).message;
        // Continue to next retry
      }
    }

    const msg = `Write failed after ${request.maxRetries} retries: ${lastError}`;
    emitWriteFailed(request.id, request.filePath, request.ownerId, request.runId, elapsed(request), request.maxRetries, msg);
    throw new Error(msg);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(req: WriteRequest): number {
  return Date.now() - req.enqueuedAt;
}

function retryDelay(attempt: number): number {
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const memoryWriteQueue = new MemoryWriteQueueManager();
