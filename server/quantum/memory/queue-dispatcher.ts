/**
 * queue-dispatcher.ts
 *
 * Executes a single queue entry: runs the memory transaction with
 * retry + timeout, emits telemetry on every state transition.
 *
 * Single responsibility: entry execution lifecycle.
 * Does NOT manage lanes (queue-core.ts) or retry policy math (queue-retry-policy.ts).
 */

import { executeTransaction } from "./memory-transaction.ts";
import {
  emitWriteStarted,
  emitWriteCompleted,
  emitWriteFailed,
  emitRetry,
} from "./memory-telemetry.ts";
import {
  evaluateRetry,
  sleep,
  DEFAULT_RETRY_CONFIG,
} from "./queue-retry-policy.ts";
import { safeWritePolicyEngine } from "./safe-write-policy-engine.ts";
import type { QueueEntry, WriteResult } from "./memory-types.ts";

// ── Entry dispatcher ──────────────────────────────────────────────────────────

/**
 * Execute one queue entry through:
 *   SafeWritePolicy → Transaction → Telemetry → Retry
 *
 * Called exclusively by queue-core.ts — never call directly.
 */
export async function executeQueueEntry(entry: QueueEntry): Promise<WriteResult> {
  const { request } = entry;
  const deadline    = request.enqueuedAt + request.timeoutMs;
  let   lastError   = "";

  emitWriteStarted(
    request.id, request.filePath,
    request.ownerId, request.runId, request.fileType,
  );

  for (let attempt = 0; attempt <= request.maxRetries; attempt++) {
    // Cancellation gate
    if (request.signal?.aborted) {
      const msg = "Write cancelled via AbortSignal";
      emitWriteFailed(
        request.id, request.filePath, request.ownerId,
        request.runId, elapsed(request), attempt, msg,
      );
      throw new Error(msg);
    }

    // Deadline gate
    if (Date.now() > deadline) {
      const msg = `Write timed out after ${request.timeoutMs}ms`;
      emitWriteFailed(
        request.id, request.filePath, request.ownerId,
        request.runId, elapsed(request), attempt, msg,
      );
      throw new Error(msg);
    }

    // Safe-write policy gate
    const policy = safeWritePolicyEngine.evaluate({
      requestId: request.id,
      ownerId:   request.ownerId,
      runId:     request.runId,
      filePath:  request.filePath,
      queueKey:  request.queueKey,
      attempt,
    });
    if (policy.verdict === "block") {
      const msg = `[SafeWritePolicy] BLOCKED: ${policy.reason}`;
      emitWriteFailed(
        request.id, request.filePath, request.ownerId,
        request.runId, elapsed(request), attempt, msg,
      );
      throw new Error(msg);
    }

    // Retry telemetry (skip attempt 0)
    if (attempt > 0) {
      emitRetry(
        request.id, request.filePath, request.ownerId,
        request.runId, attempt, lastError,
      );
      const { delayMs } = evaluateRetry(attempt, lastError, DEFAULT_RETRY_CONFIG);
      await sleep(delayMs);
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
      const decision = evaluateRetry(attempt, lastError, DEFAULT_RETRY_CONFIG);
      if (!decision.shouldRetry) break;
    }
  }

  const msg = `Write failed after ${request.maxRetries} retries: ${lastError}`;
  emitWriteFailed(
    request.id, request.filePath, request.ownerId,
    request.runId, elapsed(request), request.maxRetries, msg,
  );
  throw new Error(msg);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(req: { enqueuedAt: number }): number {
  return Date.now() - req.enqueuedAt;
}
