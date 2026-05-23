/**
 * parallel-write-isolation-layer.ts
 *
 * Wraps parallel execution paths to ensure every concurrent write is
 * isolated: separate queue keys, separate ownership tokens, no shared state.
 *
 * Single responsibility: enforce write isolation for parallel agent paths.
 *
 * Used by:
 *   - DAG parallel runner (parallel node batches)
 *   - Quantum execution engine (multi-agent writes)
 *   - Tool-loop parallel executor (parallel tool batches)
 */

import { memoryOwnershipRegistry } from "./memory-ownership-registry.ts";
import { memoryTelemetryBridge }    from "./memory-telemetry-bridge.ts";
import { deterministicWriteCoordinator } from "./deterministic-write-coordinator.ts";
import type { QueueKey, WriteResult } from "./memory-types.ts";
import type { OwnershipToken }       from "./queue.types.ts";

// ── Isolated write context ────────────────────────────────────────────────────

export interface IsolatedWriteRequest {
  /** Must be unique per parallel branch (e.g. `${runId}::branch-${i}`). */
  queueKey:    QueueKey;
  filePath:    string;
  content?:    string;
  mutator?:    (current: string) => string | Promise<string>;
  fileType:    import("./memory-types.ts").MemoryFileType;
  ownerId:     string;
  runId:       string;
  maxRetries?: number;
  timeoutMs?:  number;
  signal?:     AbortSignal;
}

export interface IsolatedWriteResult {
  queueKey:  QueueKey;
  filePath:  string;
  result:    WriteResult | null;
  error?:    string;
}

// ── Layer ─────────────────────────────────────────────────────────────────────

class ParallelWriteIsolationLayer {
  /**
   * Execute a batch of writes from parallel branches with full isolation.
   *
   * Each write:
   *   1. Claims ownership under its unique queueKey
   *   2. Routes through the deterministic write coordinator
   *   3. Revokes ownership on completion or failure
   *
   * Writes to different files are truly concurrent.
   * Writes to the SAME file are serialized via queue lanes.
   */
  async executeIsolatedBatch(
    writes: IsolatedWriteRequest[],
  ): Promise<IsolatedWriteResult[]> {
    this._assertNoDuplicatePaths(writes);

    const tasks = writes.map(w => this._executeOne(w));
    return Promise.all(tasks);
  }

  /**
   * Execute a single isolated write — claim ownership, write, revoke.
   */
  async executeSingle(req: IsolatedWriteRequest): Promise<IsolatedWriteResult> {
    return this._executeOne(req);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _executeOne(req: IsolatedWriteRequest): Promise<IsolatedWriteResult> {
    // Claim ownership
    let token: OwnershipToken | null = null;
    try {
      token = memoryOwnershipRegistry.claim({
        ownerId:  req.ownerId,
        runId:    req.runId,
        filePath: req.filePath,
        queueKey: req.queueKey,
        ttlMs:    (req.timeoutMs ?? 30_000) + 10_000,
      });
    } catch (err) {
      const error = `Ownership claim failed: ${(err as Error).message}`;
      memoryTelemetryBridge.conflict("system", req.filePath, req.runId, error);
      return { queueKey: req.queueKey, filePath: req.filePath, result: null, error };
    }

    try {
      const result = await deterministicWriteCoordinator.enqueue({
        queueKey:   req.queueKey,
        filePath:   req.filePath,
        content:    req.content,
        mutator:    req.mutator,
        fileType:   req.fileType,
        ownerId:    req.ownerId,
        runId:      req.runId,
        maxRetries: req.maxRetries,
        timeoutMs:  req.timeoutMs,
        signal:     req.signal,
      });

      return { queueKey: req.queueKey, filePath: req.filePath, result };
    } catch (err) {
      const error = (err as Error).message;
      memoryTelemetryBridge.failed("system", req.filePath, req.ownerId, req.runId, 0, error);
      return { queueKey: req.queueKey, filePath: req.filePath, result: null, error };
    } finally {
      // Always revoke — no dangling ownership
      memoryOwnershipRegistry.revoke(req.ownerId, req.runId, req.filePath, req.queueKey);
    }
  }

  /**
   * Guard against the same filePath appearing in two different queue keys
   * within the same parallel batch — that would bypass lane serialization.
   */
  private _assertNoDuplicatePaths(writes: IsolatedWriteRequest[]): void {
    const seen = new Set<string>();
    for (const w of writes) {
      if (seen.has(w.filePath)) {
        throw new Error(
          `[ParallelWriteIsolationLayer] Duplicate filePath "${w.filePath}" in parallel batch — ` +
          `use the same queueKey to serialize writes to the same file.`,
        );
      }
      seen.add(w.filePath);
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const parallelWriteIsolationLayer = new ParallelWriteIsolationLayer();
