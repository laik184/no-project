/**
 * server/quantum/conflicts/parallel-write-coordinator.ts
 *
 * Serializes concurrent write requests to the same file path.
 * Prevents write collisions from parallel agent paths by maintaining a
 * FIFO queue per file path and coordinating with the FileLockManager.
 *
 * Each write goes through:
 *   1. Enqueue (FIFO per filePath)
 *   2. Acquire file lock (blocking retry)
 *   3. Execute write callback (provided by caller)
 *   4. Validate result via ValidationGate
 *   5. Release lock + emit telemetry
 *   6. Retry on failure (exponential backoff, max 3 attempts)
 */

import { v4 as uuidv4 }            from "uuid";
import { fileLockManager }         from "../locks/file-lock-manager.ts";
import { validateMergedContent }   from "./validation-gate.ts";
import {
  emitWriteQueued,
  emitWriteCommitted,
  emitRetryStarted,
  emitRetryCompleted,
  emitMergeFailed,
} from "../telemetry/conflict-telemetry.ts";
import type { WriteRequest, WriteResult } from "./conflict-types.ts";

// ── Queue types ───────────────────────────────────────────────────────────────

type WriteFn = () => Promise<string>;  // returns the written content

interface QueueEntry {
  request:  WriteRequest;
  writeFn:  WriteFn;
  resolve:  (r: WriteResult) => void;
  reject:   (e: Error)       => void;
}

// ── Coordinator ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS  = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const BACKOFF_BASE_MS     = 500;

class ParallelWriteCoordinator {
  /** filePath → FIFO queue of pending writes */
  private readonly _queues   = new Map<string, QueueEntry[]>();
  /** filePath → is currently being processed */
  private readonly _draining = new Set<string>();

  /**
   * Submit a write request for coordinated execution.
   * Returns a promise that resolves when the write is committed (or fails).
   */
  submit(
    req:     Omit<WriteRequest, "id">,
    writeFn: WriteFn,
  ): Promise<WriteResult> {
    const request: WriteRequest = { ...req, id: uuidv4() };
    return new Promise<WriteResult>((resolve, reject) => {
      const entry: QueueEntry = { request, writeFn, resolve, reject };
      const queue = this._queues.get(request.filePath) ?? [];
      queue.push(entry);
      this._queues.set(request.filePath, queue);

      emitWriteQueued(request.quantumRunId, request.id, request.filePath, queue.length);

      // Kick off drain for this path if not already running
      if (!this._draining.has(request.filePath)) {
        this._drainPath(request.filePath);
      }
    });
  }

  /** Cancel all pending (un-started) writes for a quantumRunId. */
  cancelRun(quantumRunId: string): void {
    for (const [filePath, queue] of this._queues) {
      const remaining = queue.filter(e => e.request.quantumRunId !== quantumRunId);
      const cancelled = queue.filter(e => e.request.quantumRunId === quantumRunId);
      this._queues.set(filePath, remaining);
      for (const entry of cancelled) {
        entry.resolve({ requestId: entry.request.id, success: false, durationMs: 0, retries: 0, error: "run_cancelled" });
      }
    }
  }

  /** Wait for all queued writes for a quantum run to complete. */
  async flush(quantumRunId: string): Promise<void> {
    const pending = Array.from(this._queues.values())
      .flat()
      .filter(e => e.request.quantumRunId === quantumRunId);

    if (pending.length === 0) return;
    await new Promise<void>(r => setTimeout(r, 100));  // yield, then check again
    return this.flush(quantumRunId);
  }

  stats() {
    const pendingByPath: Record<string, number> = {};
    let total = 0;
    for (const [path, q] of this._queues) {
      pendingByPath[path] = q.length;
      total += q.length;
    }
    return { pendingByPath, totalPending: total, activePaths: this._draining.size };
  }

  // ── Private drain loop ─────────────────────────────────────────────────────

  private async _drainPath(filePath: string): Promise<void> {
    this._draining.add(filePath);

    while (true) {
      const queue = this._queues.get(filePath);
      if (!queue || queue.length === 0) break;

      const entry = queue[0];
      await this._executeEntry(entry);
      queue.shift();

      if (queue.length === 0) {
        this._queues.delete(filePath);
        break;
      }
    }

    this._draining.delete(filePath);
  }

  private async _executeEntry(entry: QueueEntry): Promise<void> {
    const { request, writeFn, resolve } = entry;
    const t0 = Date.now();
    let retries = 0;

    while (retries <= (request.maxRetries ?? DEFAULT_MAX_RETRIES)) {
      let lockId: string | undefined;

      try {
        // Acquire lock
        const lockResult = await fileLockManager.acquire(
          request.filePath,
          request.pathId,
          request.quantumRunId,
          { ttlMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: 5 },
        );

        if (!lockResult.success || !lockResult.lockId) {
          throw new Error(lockResult.failureReason ?? "Lock acquisition failed");
        }
        lockId = lockResult.lockId;

        // Execute write
        const content = await withTimeout(writeFn(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS, request.id);

        // Validate
        const validation = await validateMergedContent(request.filePath, content, request.quantumRunId);
        if (!validation.passed) {
          const issue = validation.issues.find(i => i.severity === "error")!;
          throw new Error(`Validation failed: ${issue.message}`);
        }

        // Commit success
        fileLockManager.release(lockId, request.pathId);
        const durationMs = Date.now() - t0;
        emitWriteCommitted(request.quantumRunId, request.id, request.filePath, durationMs);
        resolve({ requestId: request.id, success: true, durationMs, retries });
        return;

      } catch (err) {
        if (lockId) fileLockManager.release(lockId, request.pathId);
        const errMsg = (err as Error).message;

        if (retries >= (request.maxRetries ?? DEFAULT_MAX_RETRIES)) {
          emitMergeFailed(request.quantumRunId, request.filePath, errMsg);
          resolve({ requestId: request.id, success: false, durationMs: Date.now() - t0, retries, error: errMsg });
          return;
        }

        retries++;
        const delay = Math.min(30_000, BACKOFF_BASE_MS * Math.pow(2, retries - 1));
        emitRetryStarted(request.quantumRunId, request.id, retries, delay);
        await sleep(delay);
        emitRetryCompleted(request.quantumRunId, request.id, retries, false);
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function withTimeout<T>(promise: Promise<T>, ms: number, id: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Write "${id}" timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export const parallelWriteCoordinator = new ParallelWriteCoordinator();
