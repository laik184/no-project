/**
 * orchestration-debug.ts
 *
 * Debug utilities for the orchestration layer.
 * Provides snapshots, timelines, and health diagnostics for development and ops.
 */

import { allStates }                    from "../core/orchestration-state.ts";
import { listActiveContexts, contextCount } from "../core/orchestration-context.ts";
import { checkpointStats }              from "../core/orchestration-replay.ts";
import { traceStats, summarizeTrace }   from "./orchestration-trace.ts";
import { snapshotMetrics, orchestrationHealthSummary } from "./orchestration-metrics.ts";
import { queryLogs, logBufferSize }     from "./orchestration-logs.ts";
import { hookCount, activePhaseTimers } from "../execution/lifecycle-manager.ts";
import { telemetryStatus }              from "../execution/execution-telemetry.ts";

// ── Debug snapshot ────────────────────────────────────────────────────────────

export interface OrchestrationDebugSnapshot {
  capturedAt:     number;
  activeRuns:     RunDebugEntry[];
  metrics:        ReturnType<typeof snapshotMetrics>;
  health:         ReturnType<typeof orchestrationHealthSummary>;
  telemetry:      ReturnType<typeof telemetryStatus>;
  hooks:          ReturnType<typeof hookCount>;
  activeTimers:   string[];
  logBufferSize:  number;
  checkpoints:    ReturnType<typeof checkpointStats>;
  traces:         ReturnType<typeof traceStats>;
}

export interface RunDebugEntry {
  runId:        string;
  projectId:    number;
  phase:        string;
  status:       string;
  mode:         string;
  retryCount:   number;
  durationMs:   number;
  errors:       number;
  checkpointId?: string;
  score?:       number;
}

export function captureDebugSnapshot(): OrchestrationDebugSnapshot {
  const states = allStates();
  const now    = Date.now();

  const activeRuns: RunDebugEntry[] = states.map(s => ({
    runId:        s.runId,
    projectId:    s.projectId,
    phase:        s.phase,
    status:       s.status,
    mode:         s.mode,
    retryCount:   s.retryCount,
    durationMs:   now - s.startedAt,
    errors:       s.errorLog.length,
    checkpointId: s.checkpointId,
    score:        s.score,
  }));

  return {
    capturedAt:    now,
    activeRuns,
    metrics:       snapshotMetrics(),
    health:        orchestrationHealthSummary(),
    telemetry:     telemetryStatus(),
    hooks:         hookCount(),
    activeTimers:  activePhaseTimers(),
    logBufferSize: logBufferSize(),
    checkpoints:   checkpointStats(),
    traces:        traceStats(),
  };
}

// ── Run timeline ──────────────────────────────────────────────────────────────

export interface RunTimeline {
  runId:     string;
  phases:    PhaseTimelineEntry[];
  errors:    ErrorTimelineEntry[];
  trace?:    ReturnType<typeof summarizeTrace>;
  totalMs:   number;
  score?:    number;
}

export interface PhaseTimelineEntry {
  phase:     string;
  enteredAt: number;
  exitedAt?: number;
  durationMs?: number;
  outcome:   string;
  notes?:    string;
}

export interface ErrorTimelineEntry {
  ts:        number;
  phase:     string;
  message:   string;
  retryable: boolean;
}

export function buildRunTimeline(runId: string): RunTimeline | null {
  const states = allStates();
  const state  = states.find(s => s.runId === runId);
  if (!state) return null;

  return {
    runId,
    phases: state.phaseHistory.map(p => ({
      phase:     p.phase,
      enteredAt: p.enteredAt,
      exitedAt:  p.exitedAt,
      durationMs: p.durationMs,
      outcome:   p.outcome,
      notes:     p.notes,
    })),
    errors: state.errorLog.map(e => ({
      ts:        e.ts,
      phase:     e.phase,
      message:   e.message,
      retryable: e.retryable,
    })),
    trace:   summarizeTrace(runId) ?? undefined,
    totalMs: (state.completedAt ?? Date.now()) - state.startedAt,
    score:   state.score,
  };
}

// ── Recent logs for a run ─────────────────────────────────────────────────────

export function getRunLogs(runId: string, limit = 50) {
  return queryLogs({ runId, limit });
}

// ── Orchestration health check ────────────────────────────────────────────────

export function orchestrationHealthCheck(): {
  status:         "healthy" | "degraded" | "unhealthy";
  activeRuns:     number;
  successRate:    number;
  avgDurationMs:  number;
  checks:         Record<string, boolean>;
} {
  const health     = orchestrationHealthSummary();
  const activeRuns = allStates().filter(s => s.status === "running").length;
  const tel        = telemetryStatus();

  const hooks = hookCount();
  const checks = {
    telemetry_wired:    tel.initialized,
    lifecycle_hooks:    hooks.exit > 0, // exit hooks are the primary lifecycle signal
    context_registry:   contextCount() >= 0,
  };

  const allOk = Object.values(checks).every(Boolean);
  // A system with zero runs is healthy by default — only mark unhealthy on actual failures
  const hasRuns = health.runsStarted > 0;
  const status = !allOk ? "degraded"
    : (hasRuns && health.successRate < 0.5) ? "unhealthy"
    : "healthy";

  return {
    status,
    activeRuns,
    successRate:   health.successRate,
    avgDurationMs: health.avgDurationMs,
    checks,
  };
}
