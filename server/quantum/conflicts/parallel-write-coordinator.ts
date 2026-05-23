/**
 * parallel-write-coordinator.ts  (refactored facade — ≤250 lines)
 *
 * Serializes concurrent write requests to the same file path.
 * Prevents write collisions from parallel agent paths.
 *
 * Decomposed modules (split from original 206-line monolith):
 *   write-conflict-policy.ts     — retry delay and decision logic
 *   write-ownership-coordinator.ts — file-level ownership tracking
 *
 * Each write goes through:
 *   1. Ownership check (write-ownership-coordinator)
 *   2. Enqueue (FIFO per filePath)
 *   3. Acquire file lock (fileLockManager)
 *   4. Execute write callback
 *   5. Validate result via ValidationGate
 *   6. Release lock + emit telemetry
 *   7. Retry on failure (write-conflict-policy)
 */

import { v4 as uuidv4 }             from "uuid";
import { fileLockManager }          from "../locks/file-lock-manager.ts";
import { validateMergedContent }    from "./validation-gate.ts";
import { writeOwnershipCoordinator } from "./write-ownership-coordinator.ts";
import {
  evaluateConflictRetry,
  sleep,
  DEFAULT_CONFLICT_RETRY_CONFIG,
} from "./write-conflict-policy.ts";
import {
  emitWriteQueued,
  emitWriteCommitted,
  emitRetryStarted,
  emitRetryCompleted,
  emitMergeFailed,
} from "../telemetry/conflict-telemetry.ts";
import { memoryTelemetryBridge } from "../memory/memory-telemetry-bridge.ts";
import type { WriteRequest, WriteResult } from "./conflict-types.ts";

// ── Queue types ───────────────────────────────────────────────────────────────

type WriteFn    = () => Promise<string>;

interface QueueEntry {
  request: WriteRequest;
  writeFn: WriteFn;
  resolve: (r: WriteResult) => void;
  reject:  (e: Error)       => void;
}

// ── Coordinator ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;

class ParallelWriteCoordinator {
  private readonly _queues   = new Map<string, QueueEntry[]>();
  private readonly _draining = new Set<string>();

  /** Submit a write request for coordinated execution. */
  submit(req: Omit<WriteRequest, "id">, writeFn: WriteFn): Promise<WriteResult> {
    const request: WriteRequest = { ...req, id: uuidv4() };

    // Ownership gate — block if another run owns this file
    const ownerCheck = writeOwnershipCoordinator.acquire(
      request.filePath,
      request.quantumRunId,
      request.pathId,
      request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    if (!ownerCheck.allowed) {
      memoryTelemetryBridge.conflict(request.id, request.filePath, request.quantumRunId, ownerCheck.reason);
      return Promise.reject(new Error(`[ParallelWriteCoordinator] ${ownerCheck.reason}`));
    }

    return new Promise<WriteResult>((resolve, reject) => {
      const entry: QueueEntry = { request, writeFn, resolve, reject };
      const queue = this._queues.get(request.filePath) ?? [];
      queue.push(entry);
      this._queues.set(request.filePath, queue);

      emitWriteQueued(request.quantumRunId, request.id, request.filePath, queue.length);

      if (!this._draining.has(request.filePath)) {
        this._drainPath(request.filePath);
      }
    });
  }

  /** Cancel all pending writes for a quantumRunId. */
  cancelRun(quantumRunId: string): void {
    for (const [filePath, queue] of this._queues) {
      const remaining = queue.filter(e => e.request.quantumRunId !== quantumRunId);
      const cancelled = queue.filter(e => e.request.quantumRunId === quantumRunId);
      this._queues.set(filePath, remaining);
      for (const entry of cancelled) {
        entry.resolve({ requestId: entry.request.id, success: false, durationMs: 0, retries: 0, error: "run_cancelled" });
      }
    }
    writeOwnershipCoordinator.releaseRun(quantumRunId);
  }

  /** Wait for all queued writes for a quantum run to complete. */
  async flush(quantumRunId: string): Promise<void> {
    const pending = Array.from(this._queues.values())
      .flat()
      .filter(e => e.request.quantumRunId === quantumRunId);
    if (pending.length === 0) return;
    await sleep(100);
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

  // ── Private drain ─────────────────────────────────────────────────────────

  private async _drainPath(filePath: string): Promise<void> {
    this._draining.add(filePath);
    while (true) {
      const queue = this._queues.get(filePath);
      if (!queue || queue.length === 0) break;
      await this._executeEntry(queue[0]);
      queue.shift();
      if (queue.length === 0) { this._queues.delete(filePath); break; }
    }
    this._draining.delete(filePath);
  }

  private async _executeEntry(entry: QueueEntry): Promise<void> {
    const { request, writeFn, resolve } = entry;
    const t0 = Date.now();
    let retries = 0;

    while (retries <= (request.maxRetries ?? DEFAULT_CONFLICT_RETRY_CONFIG.maxRetries)) {
      let lockId: string | undefined;
      try {
        const lockResult = await fileLockManager.acquire(
          request.filePath, request.pathId, request.quantumRunId,
          { ttlMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: 5 },
        );
        if (!lockResult.success || !lockResult.lockId) {
          throw new Error(lockResult.failureReason ?? "Lock acquisition failed");
        }
        lockId = lockResult.lockId;
        memoryTelemetryBridge.lockAcquire(request.id, request.filePath, request.quantumRunId);

        const content    = await withTimeout(writeFn(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS, request.id);
        const validation = await validateMergedContent(request.filePath, content, request.quantumRunId);
        if (!validation.passed) {
          const issue = validation.issues.find(i => i.severity === "error")!;
          throw new Error(`Validation failed: ${issue.message}`);
        }

        fileLockManager.release(lockId, request.pathId);
        memoryTelemetryBridge.lockRelease(request.id, request.filePath, request.quantumRunId);
        writeOwnershipCoordinator.release(request.filePath, request.quantumRunId);

        const durationMs = Date.now() - t0;
        emitWriteCommitted(request.quantumRunId, request.id, request.filePath, durationMs);
        memoryTelemetryBridge.commit(request.id, request.filePath, "parallel-coordinator", request.quantumRunId, durationMs);
        resolve({ requestId: request.id, success: true, durationMs, retries });
        return;

      } catch (err) {
        if (lockId) fileLockManager.release(lockId, request.pathId);
        const errMsg  = (err as Error).message;
        const decision = evaluateConflictRetry(retries, errMsg);

        if (!decision.shouldRetry) {
          emitMergeFailed(request.quantumRunId, request.filePath, errMsg);
          memoryTelemetryBridge.failed(request.id, request.filePath, "parallel-coordinator", request.quantumRunId, Date.now() - t0, errMsg);
          resolve({ requestId: request.id, success: false, durationMs: Date.now() - t0, retries, error: errMsg });
          return;
        }

        retries++;
        emitRetryStarted(request.quantumRunId, request.id, retries, decision.delayMs);
        await sleep(decision.delayMs);
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

export const parallelWriteCoordinator = new ParallelWriteCoordinator();
