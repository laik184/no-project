/**
 * tool-loop-dispatcher.ts
 *
 * Parallel dispatch coordinator — extracted from tool-loop.agent.ts (Phase 1 split).
 *
 * Single responsibility: classify tool calls → group → dispatch as
 * parallel or serial batches via the governed worker pool.
 *
 * Bounded context: tool-loop execution only.
 * No LLM calls, no verification, no checkpoint logic here.
 */

import type { ToolContext }         from "../../../tools/orchestrator.ts";
import { buildToolGroups }          from "./execution/tool-group-builder.ts";
import { executeParallelBatch }     from "./execution/parallel-tool-executor.ts";
import { executeSerialBatch }       from "./execution/serial-tool-executor.ts";
import {
  emitBatchStarted,
  emitBatchCompleted,
  emitBatchFailed,
}                                   from "./telemetry/tool-execution-telemetry.ts";
import type { ToolExecutionRecord } from "./types/parallel-execution.types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RawToolCall {
  readonly id:        string;
  readonly name:      string;
  readonly arguments: string;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Classify → group → dispatch all tool calls in a single LLM step.
 *
 * PARALLEL_SAFE calls run concurrently via CentralWorkerPool.
 * SERIAL_REQUIRED / EXCLUSIVE_RESOURCE calls run sequentially.
 * Fail-closed: any batch failure propagates to the outer loop.
 */
export async function dispatchToolCalls(
  toolCalls: readonly RawToolCall[],
  ctx:       ToolContext,
  runId:     string,
): Promise<ToolExecutionRecord[]> {
  const rawCalls = toolCalls.map((tc) => ({
    callId: tc.id,
    name:   tc.name,
    args:   tc.arguments,
  }));

  const { batches } = buildToolGroups(rawCalls, runId);
  const allRecords: ToolExecutionRecord[] = [];

  for (const batch of batches) {
    emitBatchStarted(runId, batch.batchId, batch.mode, batch.calls.map((c) => c.name));

    let batchResult;
    try {
      batchResult = batch.mode === "parallel"
        ? await executeParallelBatch(batch.batchId, batch.calls, ctx)
        : await executeSerialBatch(batch.batchId, batch.calls, ctx);

      emitBatchCompleted(runId, batchResult);
    } catch (err: any) {
      emitBatchFailed(runId, batch.batchId, err?.message ?? "unknown batch error");
      throw err; // fail-closed: propagate to outer loop
    }

    allRecords.push(...batchResult.records);
  }

  return allRecords;
}
