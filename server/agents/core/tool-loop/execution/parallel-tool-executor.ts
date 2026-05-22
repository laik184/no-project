/**
 * server/agents/core/tool-loop/execution/parallel-tool-executor.ts
 *
 * Executes a batch of PARALLEL_SAFE tool calls concurrently using
 * Promise.allSettled with bounded concurrency.
 *
 * Safety guarantees
 * ─────────────────
 *   • Bounded concurrency: at most MAX_CONCURRENCY simultaneous calls
 *   • Promise.allSettled: no single failure aborts the batch
 *   • Per-tool timeout via tool-timeout-manager
 *   • All failures surfaced as error records — no silent swallowing
 *   • No resource locks needed (reads only — no shared state mutation)
 */

import type {
  ClassifiedCall,
  ToolExecutionRecord,
  BatchExecutionResult,
} from "../types/parallel-execution.types.ts";
import type { ToolContext } from "../../../../tools/orchestrator.ts";
import { executeToolCall }   from "../tool-call.executor.ts";
import { withTimeout }       from "./tool-timeout-manager.ts";
import {
  emitToolStarted,
  emitToolCompleted,
  emitToolFailed,
  emitToolTimeout,
} from "../telemetry/tool-execution-telemetry.ts";

const MAX_CONCURRENCY = 5;

// ── Public entry point ────────────────────────────────────────────────────────

export async function executeParallelBatch(
  batchId: string,
  calls:   ClassifiedCall[],
  ctx:     ToolContext,
  options?: { maxConcurrency?: number },
): Promise<BatchExecutionResult> {
  const batchStart   = Date.now();
  const concurrency  = options?.maxConcurrency ?? MAX_CONCURRENCY;
  const allRecords: ToolExecutionRecord[] = [];

  // Process in concurrency-bounded chunks to prevent runaway fan-out
  for (let i = 0; i < calls.length; i += concurrency) {
    const chunk   = calls.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      chunk.map((call) => executeSingle(call, ctx, batchId)),
    );

    for (let j = 0; j < settled.length; j++) {
      const s    = settled[j];
      const call = chunk[j];

      if (s.status === "fulfilled") {
        allRecords.push(s.value);
      } else {
        // executeSingle catches all errors internally — this branch is a
        // last-resort fail-closed guard for unexpected Promise rejections.
        const message = s.reason?.message ?? "Unexpected parallel execution failure";
        emitToolFailed(ctx.runId, call.callId, call.name, message, batchId);
        allRecords.push(makeErrorRecord(call, 0, message));
      }
    }
  }

  return {
    batchId,
    records:    allRecords,
    allOk:      allRecords.every((r) => r.output.execOk),
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
