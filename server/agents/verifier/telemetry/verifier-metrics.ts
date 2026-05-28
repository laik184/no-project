/**
 * server/agents/verifier/telemetry/verifier-metrics.ts
 * Metrics / telemetry aggregation for the verifier agent layer.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';

interface RunMetrics {
  runId:       string;
  startedAt:   number;
  phases:      Record<VerificationPhase, { passed: number; failed: number; totalMs: number }>;
  totalPassed: number;
  totalFailed: number;
  retries:     number;
}

const metrics = new Map<string, RunMetrics>();
const MAX_STORED = 100;

function ensure(runId: string): RunMetrics {
  let m = metrics.get(runId);
  if (!m) {
    m = { runId, startedAt: Date.now(), phases: {} as RunMetrics['phases'], totalPassed: 0, totalFailed: 0, retries: 0 };
    metrics.set(runId, m);
    if (metrics.size > MAX_STORED) {
      const oldest = [...metrics.keys()].slice(0, MAX_STORED / 2);
      oldest.forEach((k) => metrics.delete(k));
    }
  }
  return m;
}

export const verifierMetrics = {
  startRun(runId: string): void { ensure(runId); },

  recordPhase(runId: string, phase: VerificationPhase, durationMs: number, passed: boolean): void {
    const m = ensure(runId);
    if (!m.phases[phase]) m.phases[phase] = { passed: 0, failed: 0, totalMs: 0 };
    const p = m.phases[phase]!;
    p.totalMs += durationMs;
    if (passed) { p.passed++; m.totalPassed++; } else { p.failed++; m.totalFailed++; }
  },

  recordRetry(runId: string): void { ensure(runId).retries++; },

  getSummary(runId: string): RunMetrics | undefined { return metrics.get(runId); },

  totalDurationMs(runId: string): number {
    const m = metrics.get(runId);
    return m ? Date.now() - m.startedAt : 0;
  },
};
