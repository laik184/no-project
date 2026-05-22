/**
 * server/agents/core/tool-loop/execution/serial-tool-executor.ts
 *
 * Executes a batch of tool calls sequentially — deterministic order,
 * retry-safe, exclusive-lock aware, and fail-closed.
 *
 * Used for:
 *   • SERIAL_REQUIRED calls (file writes, installs, git, server ops)
 *   • EXCLUSIVE_RESOURCE calls (terminal tools)
 *   • Any batch that the group builder marks mode: "serial"
 */

import type {
  ClassifiedCall,
  ToolExecutionRecord,
  BatchExecutionResult,
  LockType,
} from "../types/parallel-execution.types.ts";
import type { ToolContext } from "../../../../tools/orchestrator.ts";
import { executeToolCall }   from "../tool-call.executor.ts";
import { toolResourceLock }  from "../locks/tool-resource-lock.ts";
import { lockTypeFromKey }   from "../classifiers/tool-call-classifier.ts";
import { withTimeout }       from "./tool-timeout-manager.ts";
import {
  emitToolStarted,
  emitToolCompleted,
  emitToolFailed,
  emitToolTimeout,
  emitToolRetry,
} from "../telemetry/tool-execution-telemetry.ts";

const MAX_RETRIES = 1;

// ── Public entry point ────────────────────────────────────────────────────────

export async function executeSerialBatch(
  batchId: string,
  calls:   ClassifiedCall[],
  ctx:     ToolContext,
): Promise<BatchExecutionResult> {
  const batchStart = Date.now();
  const records: ToolExecutionRecord[] = [];

  for (const call of calls) {
    const record = await executeOneWithRetry(call, ctx, batchId);
    records.push(record);
  }

  return {
    batchId,
    records,
    allOk:      records.every((r) => r.output.execOk),
    durationMs: Date.now() - batchStart,
  };
}

// ── Per-call execution with retry + lock ──────────────────────────────────────

async function executeOneWithRetry(
  call:    ClassifiedCall,
  ctx:     ToolContext,
  batchId: string,
): Promise<ToolExecutionRecord> {
  // Acquire all resource locks before executing
  const acquiredKeys: string[] = [];
  for (const key of call.resourceKeys) {
    if (toolResourceLock.acquire(key, lockTypeFromKey(key), call.callId)) {
      acquiredKeys.push(key);
    }
  }

  let retryCount = 0;

  try {
    while (true) {
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
          return makeErrorRecord(call, Date.now() - callStart, retryCount, true,
            `[TIMEOUT] Tool ${call.name} exceeded ${timedResult.timeoutMs}ms`);
        }

        const record: ToolExecutionRecord = {
          callId:     call.callId,
          name:       call.name,
          output:     timedResult.result,
          durationMs: Date.now() - callStart,
          retryCount,
          timedOut:   false,
        };
        emitToolCompleted(ctx.runId, record, batchId);
        return record;

      } catch (err: any) {
        const durationMs = Date.now() - callStart;
        const message = err?.message ?? String(err);
        emitToolFailed(ctx.runId, call.callId, call.name, message, batchId);

        if (retryCount < MAX_RETRIES) {
          retryCount++;
          emitToolRetry(ctx.runId, call.callId, call.name, retryCount);
          continue;
        }

        return makeErrorRecord(call, durationMs, retryCount, false, message);
      }
    }
  } finally {
    for (const key of acquiredKeys) toolResourceLock.release(key, call.callId);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeErrorRecord(
  call:       ClassifiedCall,
  durationMs: number,
  retryCount: number,
  timedOut:   boolean,
  message:    string,
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
    retryCount,
    timedOut,
  };
}
