/**
 * aggregation-telemetry.ts
 *
 * Emits typed bus events for every significant aggregation lifecycle step.
 * Single responsibility: bus emission only — no aggregation logic here.
 */

import { bus }                      from "../../infrastructure/events/bus.ts";
import { incrementCounter }         from "../../orchestration/telemetry/metrics.ts";
import { recordSpanStart, recordSpanEnd, addSpanEvent } from "../../orchestration/telemetry/metrics.ts";
import type { MergeConflict, CollapsedExecutionState, ValidationReport } from "./aggregation-types.ts";

// ── Aggregation lifecycle ─────────────────────────────────────────────────────

export function emitAggregationStarted(runId: string, projectId: number, waveIndex: number, nodeCount: number): string {
  const spanId = recordSpanStart(runId, `wave-aggregation:${waveIndex}`, {
    projectId, waveIndex, nodeCount,
  });
  bus.emit("agent.event", {
    runId, projectId, phase: "aggregate", agentName: "result-aggregator",
    eventType: "quantum.aggregation.started",
    payload: { waveIndex, nodeCount },
    ts: Date.now(),
  });
  incrementCounter("quantum.aggregation.started", { runId: runId.slice(-8) });
  return spanId;
}

export function emitAggregationCompleted(
  runId: string, projectId: number, waveIndex: number,
  spanId: string, durationMs: number, nodeCount: number,
): void {
  recordSpanEnd(spanId, "ok");
  bus.emit("agent.event", {
    runId, projectId, phase: "aggregate", agentName: "result-aggregator",
    eventType: "quantum.aggregation.completed",
    payload: { waveIndex, nodeCount, durationMs },
    ts: Date.now(),
  });
  incrementCounter("quantum.aggregation.completed", { runId: runId.slice(-8) });
}

export function emitAggregationFailed(
  runId: string, projectId: number, waveIndex: number,
  spanId: string, reason: string,
): void {
  recordSpanEnd(spanId, "error");
  bus.emit("agent.event", {
    runId, projectId, phase: "aggregate", agentName: "result-aggregator",
    eventType: "quantum.aggregation.failed",
    payload: { waveIndex, reason },
    ts: Date.now(),
  });
  incrementCounter("quantum.aggregation.failed", { runId: runId.slice(-8) });
}

// ── Merge conflict events ─────────────────────────────────────────────────────

export function emitMergeConflict(conflict: MergeConflict): void {
  bus.emit("agent.event", {
    runId: conflict.runId, phase: "merge", agentName: "merge-engine",
    eventType: "quantum.merge.conflict",
    payload: { kind: conflict.kind, filePath: conflict.filePath,
      ownerA: conflict.ownerA, ownerB: conflict.ownerB },
    ts: Date.now(),
  });
  incrementCounter("quantum.merge.conflict", { kind: conflict.kind });
}

export function emitMergeRetry(runId: string, filePath: string, attempt: number): void {
  bus.emit("agent.event", {
    runId, phase: "merge", agentName: "merge-engine",
    eventType: "quantum.merge.retry",
    payload: { filePath, attempt },
    ts: Date.now(),
  });
  incrementCounter("quantum.merge.retry", {});
}

// ── Collapse events ────────────────────────────────────────────────────────────

export function emitCollapseCompleted(state: CollapsedExecutionState, spanId: string): void {
  recordSpanEnd(spanId, state.safe ? "ok" : "error");
  addSpanEvent(spanId, "collapse.completed", {
    winnerNodeId: state.winnerNodeId,
    conflicts: state.conflicts,
    safe: state.safe,
  });
  bus.emit("agent.event", {
    runId: state.runId, projectId: state.projectId,
    phase: "collapse", agentName: "collapse-engine",
    eventType: "quantum.collapse.completed",
    payload: {
      waveIndex: state.waveIndex,
      winnerNodeId: state.winnerNodeId,
      mergedFiles: state.mergedFiles.length,
      safe: state.safe,
      overallConfidence: state.overallConfidence,
    },
    ts: Date.now(),
  });
  incrementCounter("quantum.collapse.completed", { safe: String(state.safe) });
}

export function emitCollapseFailed(runId: string, projectId: number, waveIndex: number, reason: string): void {
  bus.emit("agent.event", {
    runId, projectId, phase: "collapse", agentName: "collapse-engine",
    eventType: "quantum.collapse.failed",
    payload: { waveIndex, reason },
    ts: Date.now(),
  });
  incrementCounter("quantum.collapse.failed", {});
}

// ── Validation events ──────────────────────────────────────────────────────────

export function emitValidationFailed(runId: string, projectId: number, report: ValidationReport): void {
  bus.emit("agent.event", {
    runId, projectId, phase: "validate", agentName: "aggregation-validator",
    eventType: "quantum.validation.failed",
    payload: { blockedReason: report.blockedReason,
      failedChecks: report.checks.filter(c => !c.passed).map(c => c.name) },
    ts: Date.now(),
  });
  incrementCounter("quantum.validation.failed", {});
}
