/**
 * server/agents/core/tool-loop/execution/parallel-tool-executor.ts
 *
 * Executes a batch of PARALLEL_SAFE tool calls concurrently by routing each
 * call through the CentralWorkerPool — replacing raw Promise.allSettled with
 * governed, backpressure-aware, priority-scheduled execution.
 *
 * Architecture upgrade (Phase 1 + 2)
 * ────────────────────────────────────
 *   BEFORE: raw Promise.allSettled with manual concurrency chunking (MAX=5)
 *   AFTER:  every tool call is a PoolTask submitted to CentralWorkerPool
 *
 * Safety guarantees
 * ─────────────────
 *   ✅ Governed concurrency: CentralWorkerPool enforces system-wide cap
 *   ✅ Backpressure: pool rejects admission when saturated — fail-closed
 *   ✅ Priority scheduling: tool calls run at NORMAL priority
 *   ✅ Per-tool timeout via tool-timeout-manager (inner) + pool hard cap (outer)
 *   ✅ AbortSignal-aware cancellation propagated to pool tasks
 *   ✅ All failures surfaced as error records — no silent swallowing
 *   ✅ Full telemetry: tool.started / completed / failed / timeout emitted
 *   ✅ Worker-level telemetry emitted by pool (worker.spawned / completed / failed)
 */

import type {
  ClassifiedCall,
  ToolExecutionRecord,
  BatchExecutionResult,
} from "../types/parallel-execution.types.ts";
import type { ToolContext }  from "../../../../tools/orchestrator.ts";
import { executeToolCall }   from "../tool-call.executor.ts";
import { withTimeout }       from "./tool-timeout-manager.ts";
import {
  emitToolStarted,
  emitToolCompleted,
  emitToolFailed,
  emitToolTimeout,
}                            from "../telemetry/tool-execution-telemetry.ts";
import { centralWorkerPool } from "../../../../quantum/scheduler/worker-pool.ts";
import { TaskPriority }      from "../../../../quantum/scheduler/worker-types.ts";
import type { PoolTask }     from "../../../../quantum/scheduler/worker-types.ts";

// Hard outer timeout enforced by pool — inner tool-timeout-manager fires first
const POOL_HARD_TIMEOUT_MS = 60_000;

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Submit all PARALLEL_SAFE calls as governed PoolTasks.
 * CentralWorkerPool manages system-wide concurrency — no manual chunking needed.
 * Fails closed: pool backpressure errors surface as error records.
 */
export async function executeParallelBatch(
  batchId:  string,
  calls:    ClassifiedCall[],
  ctx:      ToolContext,
  _options?: { maxConcurrency?: number },
): Promise<BatchExecutionResult> {
  const batchStart = Date.now();

  const poolTasks: PoolTask<ToolExecutionRecord>[] = calls.map(call => ({
    id:            call.callId,
    runId:         ctx.runId,
    priority:      TaskPriority.NORMAL,
    timeoutMs:     POOL_HARD_TIMEOUT_MS,
    maxRetries:    0,           // retries handled at tool-loop level
    taskType:      "tool-call",
    executionMode: "parallel" as const,
    fn:            () => executeSingle(call, ctx, batchId),
    signal:        ctx.signal,
    metadata:      { batchId, toolName: call.name },
  }));

  // Submit all tasks — pool governs admission, concurrency, backpressure
  const poolResults = await Promise.all(
    poolTasks.map(task => centralWorkerPool.submit<ToolExecutionRecord>(task)),
  );

  const allRecords: ToolExecutionRecord[] = poolResults.map((result, i) => {
    if (result.success && result.data) return result.data;
    // Pool-level failure: backpressure rejection, hard timeout, or worker crash
    const call    = calls[i];
    const message = result.error ?? "Worker pool execution failure";
    emitToolFailed(ctx.runId, call.callId, call.name, message, batchId);
    return makeErrorRecord(call, result.durationMs, message);
  });

  return {
    batchId,
    records:    allRecords,
    allOk:      allRecords.every(r => r.output.execOk),
    durationMs: Date.now() - batchStart,
  };
}

// ── Single-tool execution (never rejects — all errors become error records) ───

async function executeSingle(
  call:    ClassifiedCall,
  ctx:     ToolContext,
  batchId: string,
): Promise<ToolExecutionRecord> {
  emitToolStarted(ctx.runId, call.callId, call.name, batchId);
  const callStart = Date.now();

  try {
    const timedResult = await withTimeout(
      executeToolCall({ callId: call.callId, name: call.name, args: call.args, ctx }),
      call.name,
      call.callId,
    );

    if (timedResult.timedOut) {
      emitToolTimeout(ctx.runId, call.callId, call.name, timedResult.timeoutMs);
      return makeErrorRecord(
        call, Date.now() - callStart,
        `[TIMEOUT] ${call.name} exceeded ${timedResult.timeoutMs}ms`,
        true,
      );
    }

    const record: ToolExecutionRecord = {
      callId:     call.callId,
      name:       call.name,
      output:     timedResult.result,
      durationMs: Date.now() - callStart,
      retryCount: 0,
      timedOut:   false,
    };
    emitToolCompleted(ctx.runId, record, batchId);
    return record;

  } catch (err: any) {
    const message = err?.message ?? String(err);
    emitToolFailed(ctx.runId, call.callId, call.name, message, batchId);
    return makeErrorRecord(call, Date.now() - callStart, message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeErrorRecord(
  call:       ClassifiedCall,
  durationMs: number,
  message:    string,
  timedOut    = false,
): ToolExecutionRecord {
  return {
    callId:     call.callId,
    name:       call.name,
    output:     {
      content:    JSON.stringify({ ok: false, error: message }),
      isTerminal: false,
      execOk:     false,
      parsedArgs: {},
    },
    durationMs,
    retryCount: 0,
    timedOut,
  };
}
