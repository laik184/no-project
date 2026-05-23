/**
 * node-write-dispatcher.ts
 *
 * Isolates write execution for DAG tool nodes.
 * Routes all file mutations produced by tool nodes through the
 * transactionalMemoryWriter → deterministicWriteCoordinator.
 *
 * Ensures every DAG-driven file write is:
 *   ✅ serialized per project lane
 *   ✅ ownership-validated
 *   ✅ telemetry-emitted
 *   ✅ rollback-safe
 *
 * Single responsibility: bridge between node-executor and memory write queue.
 */

import { transactionalMemoryWriter } from "../../quantum/memory/transactional-memory-writer.ts";
import { memoryTelemetryBridge }     from "../../quantum/memory/memory-telemetry-bridge.ts";
import type { MemoryFileType }       from "../../quantum/memory/memory-types.ts";

// ── Write descriptor ──────────────────────────────────────────────────────────

export interface NodeFileWrite {
  /** Absolute path to the file being written. */
  filePath:  string;
  /** Static content replacement. Mutually exclusive with mutator. */
  content?:  string;
  /** Read-modify-write function (for patch-style mutations). */
  mutator?:  (current: string) => string | Promise<string>;
  /** File format — defaults to "text". */
  fileType?: MemoryFileType;
}

export interface NodeWriteContext {
  runId:     string;
  projectId: number;
  nodeId:    string;
  toolName:  string;
}

export interface NodeWriteResult {
  filePath:   string;
  success:    boolean;
  durationMs: number;
  checksum?:  string;
  error?:     string;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

class NodeWriteDispatcher {
  /**
   * Dispatch a single file write from a tool node through the safe write queue.
   */
  async dispatch(write: NodeFileWrite, ctx: NodeWriteContext): Promise<NodeWriteResult> {
    const queueKey = String(ctx.projectId);
    const ownerId  = `dag::${ctx.nodeId}::${ctx.toolName}`;

    try {
      const result = await transactionalMemoryWriter.write({
        queueKey,
        filePath:  write.filePath,
        content:   write.content,
        mutator:   write.mutator,
        fileType:  write.fileType ?? "text",
        ownerId,
        runId:     ctx.runId,
      });

      return {
        filePath:   write.filePath,
        success:    result.success,
        durationMs: result.durationMs,
        checksum:   result.checksum,
      };
    } catch (err) {
      const error = (err as Error).message;
      memoryTelemetryBridge.failed(
        "system", write.filePath, ownerId, ctx.runId, 0, error,
      );
      return { filePath: write.filePath, success: false, durationMs: 0, error };
    }
  }

  /**
   * Dispatch multiple file writes from a single tool node.
   * Writes to different files are parallelized via Promise.all.
   * Writes to the SAME file are serialized through the lane manager.
   */
  async dispatchBatch(writes: NodeFileWrite[], ctx: NodeWriteContext): Promise<NodeWriteResult[]> {
    return Promise.all(writes.map(w => this.dispatch(w, ctx)));
  }

  /**
   * Revoke all write ownership tokens when a run completes.
   * MUST be called on run completion (success and failure).
   */
  releaseRun(runId: string): void {
    transactionalMemoryWriter.revokeRun(runId);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const nodeWriteDispatcher = new NodeWriteDispatcher();
