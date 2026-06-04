/**
 * server/agents/browser/telemetry/browser-metrics.ts
 *
 * Per-run browser telemetry counters.
 * Exports `browserMetrics` singleton (used by tools layer)
 * and named helpers (used by orchestration layer).
 */

// ── Per-run counters ──────────────────────────────────────────────────────────

export interface RunCounters {
  runId:          string;
  screenshots:    number;
  interactions:   number;
  navigations:    number;
  consoleErrors:  number;
  crashes:        number;
  flows:          number;
  flowsOk:        number;
  validations:    number;
  validationsOk:  number;
}

export interface RunMetrics {
  runId:      string;
  ok:         boolean;
  steps:      number;
  durationMs: number;
  ts:         string;
}

export interface StepMetrics {
  tool:       string;
  ok:         boolean;
  durationMs: number;
  ts:         string;
}

export interface AgentMetricsSummary {
  totalRuns:     number;
  successRuns:   number;
  failedRuns:    number;
  successRate:   number;
  totalSteps:    number;
  avgDurationMs: number;
  stepsByTool:   Record<string, { total: number; ok: number; failed: number }>;
}

// ── Internal stores ───────────────────────────────────────────────────────────

const _counters = new Map<string, RunCounters>();
const _runs:  RunMetrics[]  = [];
const _steps: StepMetrics[] = [];
const MAX_RECORDS = 500;

function getOrCreate(runId: string): RunCounters {
  if (!_counters.has(runId)) {
    _counters.set(runId, {
      runId, screenshots: 0, interactions: 0, navigations: 0,
      consoleErrors: 0, crashes: 0, flows: 0, flowsOk: 0,
      validations: 0, validationsOk: 0,
    });
  }
  return _counters.get(runId)!;
}

// ── Singleton (used by tools layer) ──────────────────────────────────────────

export const browserMetrics = {
  get(runId: string): RunCounters {
    return getOrCreate(runId);
  },

  recordScreenshot(runId: string): void {
    getOrCreate(runId).screenshots++;
  },

  recordInteraction(runId: string): void {
    getOrCreate(runId).interactions++;
  },

  recordNavigation(runId: string): void {
    getOrCreate(runId).navigations++;
  },

  recordConsoleError(runId: string): void {
    getOrCreate(runId).consoleErrors++;
  },

  recordCrash(runId: string): void {
    getOrCreate(runId).crashes++;
  },

  recordFlow(runId: string, ok: boolean): void {
    const c = getOrCreate(runId);
    c.flows++;
    if (ok) c.flowsOk++;
  },

  recordValidation(runId: string, ok: boolean): void {
    const c = getOrCreate(runId);
    c.validations++;
    if (ok) c.validationsOk++;
  },

  clear(runId: string): void {
    _counters.delete(runId);
  },
};

// ── Named helpers (orchestration layer) ──────────────────────────────────────

export function recordRunMetric(
  runId:      string,
  ok:         boolean,
  durationMs: number,
  steps:      number,
): void {
  if (_runs.length >= MAX_RECORDS) _runs.shift();
  _runs.push({ runId, ok, steps, durationMs, ts: new Date().toISOString() });
}

export function recordStepMetric(
  tool:       string,
  ok:         boolean,
  durationMs: number,
): void {
  if (_steps.length >= MAX_RECORDS) _steps.shift();
  _steps.push({ tool, ok, durationMs, ts: new Date().toISOString() });
}

export function getAgentMetrics(): AgentMetricsSummary {
  const totalRuns   = _runs.length;
  const successRuns = _runs.filter(r => r.ok).length;
  const failedRuns  = totalRuns - successRuns;
  const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
  const totalSteps  = _steps.length;
  const avgDuration = totalRuns > 0
    ? Math.round(_runs.reduce((acc, r) => acc + r.durationMs, 0) / totalRuns)
    : 0;

  const stepsByTool: Record<string, { total: number; ok: number; failed: number }> = {};
  for (const s of _steps) {
    if (!stepsByTool[s.tool]) stepsByTool[s.tool] = { total: 0, ok: 0, failed: 0 };
    stepsByTool[s.tool].total++;
    if (s.ok) stepsByTool[s.tool].ok++;
    else      stepsByTool[s.tool].failed++;
  }

  return {
    totalRuns, successRuns, failedRuns, successRate,
    totalSteps, avgDurationMs: avgDuration, stepsByTool,
  };
}

export function getRunMetrics(runId: string): RunMetrics | undefined {
  return [..._runs].reverse().find(r => r.runId === runId);
}

export function clearMetrics(): void {
  _runs.length  = 0;
  _steps.length = 0;
  _counters.clear();
}
