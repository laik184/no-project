/**
 * transactional-memory-writer.ts
 *
 * High-level writer that combines ownership claim + coordinator enqueue
 * into a single transactional API for external callers.
 *
 * Single responsibility: integrate ownership management with write dispatch.
 *
 * Callers outside the quantum/memory module should prefer this over calling
 * deterministicWriteCoordinator directly, as it handles ownership lifecycle.
 *
 * Usage:
 *   const result = await transactionalMemoryWriter.write({
 *     queueKey: String(projectId),
 *     filePath: "/abs/path/memory.md",
 *     content: "...",
 *     fileType: "markdown",
 *     ownerId: "memory-store",
 *     runId: runId,
 *   });
 */

import { memoryOwnershipRegistry }       from "./memory-ownership-registry.ts";
import { deterministicWriteCoordinator } from "./deterministic-write-coordinator.ts";
import { memoryTelemetryBridge }         from "./memory-telemetry-bridge.ts";
import { rollbackConsistencyValidator }  from "./rollback-consistency-validator.ts";
import type { QueueKey, WriteResult, MemoryFileType } from "./memory-types.ts";

// ── Write params ──────────────────────────────────────────────────────────────

export interface TransactionalWriteParams {
  queueKey:    QueueKey;
  filePath:    string;
  content?:    string;
  mutator?:    (current: string) => string | Promise<string>;
  fileType:    MemoryFileType;
  ownerId:     string;
  runId:       string;
  maxRetries?: number;
  timeoutMs?:  number;
  signal?:     AbortSignal;
}

// ── Rollback params ───────────────────────────────────────────────────────────

export interface TransactionalRollbackParams {
  requestId:        string;
  filePath:         string;
  backupPath:       string;
  expectedChecksum?: string;
  quantumRunId?:    string;
}

// ── Writer ────────────────────────────────────────────────────────────────────

class TransactionalMemoryWriter {
  /**
   * Claim ownership → enqueue write → revoke ownership.
   * This is the canonical external API for safe memory writes.
   */
  async write(params: TransactionalWriteParams): Promise<WriteResult> {
    // Claim ownership before enqueuing
    const token = memoryOwnershipRegistry.claim({
      ownerId:  params.ownerId,
      runId:    params.runId,
      filePath: params.filePath,
      queueKey: params.queueKey,
      ttlMs:    (params.timeoutMs ?? 30_000) + 10_000,
    });

    try {
      const result = await deterministicWriteCoordinator.enqueue({
        queueKey:   params.queueKey,
        filePath:   params.filePath,
        content:    params.content,
        mutator:    params.mutator,
        fileType:   params.fileType,
        ownerId:    params.ownerId,
        runId:      params.runId,
        maxRetries: params.maxRetries,
        timeoutMs:  params.timeoutMs,
        signal:     params.signal,
      });

      memoryTelemetryBridge.commit(
        result.requestId, params.filePath, params.ownerId, params.runId,
        result.durationMs, result.checksum,
      );

      return result;
    } catch (err) {
      const error = (err as Error).message;
      memoryTelemetryBridge.rollback(token.tokenId, params.filePath, params.ownerId, params.runId, error);
      throw err;
    } finally {
      // Ownership always revoked — no leaking tokens
      memoryOwnershipRegistry.revoke(params.ownerId, params.runId, params.filePath, params.queueKey);
    }
  }

  /**
   * Rollback a previously committed write.
   * Validates consistency before restoring the backup.
   */
  async rollback(params: TransactionalRollbackParams): Promise<{ success: boolean; reason: string }> {
    const result = await rollbackConsistencyValidator.execute({
      requestId:        params.requestId,
      filePath:         params.filePath,
      backupPath:       params.backupPath,
      expectedChecksum: params.expectedChecksum,
      quantumRunId:     params.quantumRunId,
    });

    if (result.success) {
      memoryTelemetryBridge.rollback(params.requestId, params.filePath, "system", "system", "rollback-success");
    }

    return { success: result.success, reason: result.reason };
  }

  /**
   * Revoke all ownership tokens for a completed run.
   * Call this after a run finishes (success or failure).
   */
  revokeRun(runId: string): void {
    const count = memoryOwnershipRegistry.revokeRun(runId);
    if (count > 0) {
      memoryTelemetryBridge.emit({
        event:     "lock.release",
        requestId: "system",
        runId,
        meta:      { tokensRevoked: count },
      });
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const transactionalMemoryWriter = new TransactionalMemoryWriter();
