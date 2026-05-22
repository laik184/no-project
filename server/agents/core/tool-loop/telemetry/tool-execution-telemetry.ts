/**
 * server/agents/core/tool-loop/telemetry/tool-execution-telemetry.ts
 *
 * Typed telemetry emitters for the parallel tool execution system.
 * All events flow through the shared EventBus and are captured by
 * server/telemetry/telemetry-collector.ts.
 *
 * Events emitted
 * ──────────────
 *   tool.parallel.batch.started
 *   tool.parallel.batch.completed
 *   tool.parallel.batch.failed
 *   tool.execution.started
 *   tool.execution.completed
 *   tool.execution.failed
 *   tool.execution.timeout
 *   tool.execution.retry
 *   tool.execution.serialized
 *   tool.execution.blocked
 */

import { bus } from "../../../../infrastructure/events/bus.ts";
import type { BatchExecutionResult, ToolExecutionRecord } from "../types/parallel-execution.types.ts";

function emit(runId: string, eventType: string, payload: unknown): void {
  bus.emit("agent.event", {
    runId,
    eventType: eventType as any,
    phase:     "tool-execution",
    ts:        Date.now(),
    payload,
  });
}

// ── Batch-level ───────────────────────────────────────────────────────────────

export function emitBatchStarted(
  runId:     string,
  batchId:   string,
  mode:      "parallel" | "serial",
  toolNames: string[],
): void {
  emit(runId, "tool.parallel.batch.started", { batchId, mode, toolNames, count: toolNames.length });
}

export function emitBatchCompleted(runId: string, result: BatchExecutionResult): void {
  emit(runId, "tool.parallel.batch.completed", {
    batchId:    result.batchId,
    durationMs: result.durationMs,
    allOk:      result.allOk,
    count:      result.records.length,
    tools:      result.records.map((r) => ({
      name:       r.name,
      ok:         r.output.execOk,
      durationMs: r.durationMs,
      timedOut:   r.timedOut,
    })),
  });
}

export function emitBatchFailed(runId: string, batchId: string, error: string): void {
  emit(runId, "tool.parallel.batch.failed", { batchId, error });
}

// ── Tool-level ────────────────────────────────────────────────────────────────

export function emitToolStarted(
  runId:   string,
  callId:  string,
  name:    string,
  batchId: string,
): void {
  emit(runId, "tool.execution.started", { callId, toolName: name, batchId });
}

export function emitToolCompleted(
  runId:   string,
  record:  ToolExecutionRecord,
  batchId: string,
): void {
  emit(runId, "tool.execution.completed", {
    callId:     record.callId,
    toolName:   record.name,
    batchId,
    durationMs: record.durationMs,
    ok:         record.output.execOk,
    retryCount: record.retryCount,
    timedOut:   record.timedOut,
  });
}

export function emitToolFailed(
  runId:   string,
  callId:  string,
  name:    string,
  error:   string,
  batchId: string,
): void {
  emit(runId, "tool.execution.failed", { callId, toolName: name, batchId, error });
}

export function emitToolTimeout(
  runId:     string,
  callId:    string,
  name:      string,
  timeoutMs: number,
): void {
  emit(runId, "tool.execution.timeout", { callId, toolName: name, timeoutMs });
}

export function emitToolRetry(
  runId:   string,
  callId:  string,
  name:    string,
  attempt: number,
): void {
  emit(runId, "tool.execution.retry", { callId, toolName: name, attempt });
}

export function emitToolSerialized(
  runId:  string,
  callId: string,
  name:   string,
  reason: string,
): void {
  emit(runId, "tool.execution.serialized", { callId, toolName: name, reason });
}

export function emitConflictsDetected(
  runId:     string,
  batchId:   string,
  conflicts: unknown[],
): void {
  emit(runId, "tool.execution.blocked", { batchId, conflicts, resolution: "serialize" });
}
