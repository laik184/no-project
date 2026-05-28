/**
 * server/orchestration/telemetry/orchestration-metrics.ts
 *
 * Tracks orchestration-level metrics: counts, success rates, durations, retries.
 * In-memory store — no external dependencies, no tool execution.
 */

// ── Per-run metrics ───────────────────────────────────────────────────────────

interface RunMetrics {
  orchestrationId:    string;
  runId:              string;
  startedAt:          Date;
  endedAt?:           Date;
  durationMs?:        number;
  workflowsTotal:     number;
  workflowsCompleted: number;
  workflowsFailed:    number;
  phasesTotal:        number;
  phasesCompleted:    number;
  phasesFailed:       number;
  retries:            number;
  escalations:        number;
  ok?:                boolean;
}

// ── Global counters ───────────────────────────────────────────────────────────

interface GlobalMetrics {
  totalOrchestrations: number;
  succeeded:           number;
  failed:              number;
  escalated:           number;
  totalRetries:        number;
  totalDurationMs:     number;
}

// ── State ─────────────────────────────────────────────────────────────────────

const _runs    = new Map<string, RunMetrics>();
const _global: GlobalMetrics = {
  totalOrchestrations: 0,
  succeeded:           0,
  failed:              0,
  escalated:           0,
  totalRetries:        0,
  totalDurationMs:     0,
};

// ── Run-scoped API ────────────────────────────────────────────────────────────

export function initRunMetrics(orchestrationId: string, runId: string): void {
  _runs.set(runId, {
    orchestrationId,
    runId,
    startedAt:          new Date(),
    workflowsTotal:     0,
    workflowsCompleted: 0,
    workflowsFailed:    0,
    phasesTotal:        0,
    phasesCompleted:    0,
    phasesFailed:       0,
    retries:            0,
    escalations:        0,
  });
  _global.totalOrchestrations++;
}

export function recordWorkflowStarted(runId: string): void {
  const m = _runs.get(runId);
  if (m) m.workflowsTotal++;
}

export function recordWorkflowCompleted(runId: string): void {
  const m = _runs.get(runId);
  if (m) m.workflowsCompleted++;
}

export function recordWorkflowFailed(runId: string): void {
  const m = _runs.get(runId);
  if (m) m.workflowsFailed++;
}

export function recordPhaseStarted(runId: string): void {
  const m = _runs.get(runId);
  if (m) m.phasesTotal++;
}

export function recordPhaseCompleted(runId: string): void {
  const m = _runs.get(runId);
  if (m) m.phasesCompleted++;
}

export function recordPhaseFailed(runId: string): void {
  const m = _runs.get(runId);
  if (m) m.phasesFailed++;
}

export function recordRetry(runId: string): void {
  const m = _runs.get(runId);
  if (m) {
    m.retries++;
    _global.totalRetries++;
  }
}

export function recordEscalation(runId: string): void {
  const m = _runs.get(runId);
  if (m) {
    m.escalations++;
    _global.escalated++;
  }
}

export function finalizeRunMetrics(runId: string, ok: boolean): void {
  const m = _runs.get(runId);
  if (!m) return;
  m.endedAt    = new Date();
  m.durationMs = m.endedAt.getTime() - m.startedAt.getTime();
  m.ok         = ok;
  if (ok) {
    _global.succeeded++;
  } else {
    _global.failed++;
  }
  _global.totalDurationMs += m.durationMs;
}

// ── Read API ──────────────────────────────────────────────────────────────────

export function getRunMetrics(runId: string): RunMetrics | undefined {
  return _runs.get(runId);
}

export function globalSummary(): GlobalMetrics & { avgDurationMs: number; successRate: number } {
  const total = _global.totalOrchestrations;
  return {
    ..._global,
    avgDurationMs: total > 0 ? Math.round(_global.totalDurationMs / total) : 0,
    successRate:   total > 0 ? Math.round((_global.succeeded / total) * 100) : 0,
  };
}

export function clearRunMetrics(runId: string): void {
  _runs.delete(runId);
}
