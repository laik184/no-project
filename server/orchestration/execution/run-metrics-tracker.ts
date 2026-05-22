/**
 * run-metrics-tracker.ts
 *
 * Per-run live metrics counters fed by execution subsystems.
 * Provides the RerouteMetricsInput snapshot consumed by the reroute hook.
 * Best-effort counters — never throw on mutation.
 */

import type { RerouteMetricsInput } from "./execution-reroute-hook.ts";

// ── Store ─────────────────────────────────────────────────────────────────────

interface RunMetrics {
  retryCount:            number;
  filesTouchedCount:     number;
  verificationFailCount: number;
  toolFailureCount:      number;
  runtimeStatus:         string;
  runtimeRestarts:       number;
  dependencyCount:       number;
  agentConfidenceScore:  number;
  hallucinationRisk:     number;
  reflectionSeverity:    number;
  stepCount:             number;
  stepTotalMs:           number;
}

const _store = new Map<string, RunMetrics>();

function _get(runId: string): RunMetrics {
  if (!_store.has(runId)) {
    _store.set(runId, {
      retryCount: 0, filesTouchedCount: 0, verificationFailCount: 0,
      toolFailureCount: 0, runtimeStatus: "running", runtimeRestarts: 0,
      dependencyCount: 0, agentConfidenceScore: 0.8, hallucinationRisk: 0,
      reflectionSeverity: 0, stepCount: 0, stepTotalMs: 0,
    });
  }
  return _store.get(runId)!;
}

// ── Mutation API (called by execution subsystems) ─────────────────────────────

export function recordToolFailure(runId: string):        void { try { _get(runId).toolFailureCount++;      } catch { /**/ } }
export function recordFileTouched(runId: string, n = 1): void { try { _get(runId).filesTouchedCount += n;  } catch { /**/ } }
export function recordVerificationFailure(runId: string):void { try { _get(runId).verificationFailCount++; } catch { /**/ } }
export function recordRetry(runId: string):              void { try { _get(runId).retryCount++;             } catch { /**/ } }
export function recordDependencies(runId: string, n: number): void { try { _get(runId).dependencyCount = n; } catch { /**/ } }
export function recordConfidence(runId: string, score: number):void { try { _get(runId).agentConfidenceScore = score; } catch { /**/ } }
export function recordHallucination(runId: string, r: number): void { try { _get(runId).hallucinationRisk = r; } catch { /**/ } }
export function recordReflectionSeverity(runId: string, s: number): void { try { _get(runId).reflectionSeverity = s; } catch { /**/ } }

export function recordRuntimeRestart(runId: string): void {
  try { const m = _get(runId); m.runtimeRestarts++; m.runtimeStatus = "running"; } catch { /**/ }
}
export function recordRuntimeCrash(runId: string): void {
  try { _get(runId).runtimeStatus = "crashed"; } catch { /**/ }
}
export function recordStepDuration(runId: string, ms: number): void {
  try {
    const m = _get(runId);
    m.stepCount++;
    m.stepTotalMs += ms;
  } catch { /**/ }
}

// ── Snapshot (read) ───────────────────────────────────────────────────────────

export function getMetricsSnapshot(runId: string): RerouteMetricsInput {
  const m = _get(runId);
  return {
    retryCount:            m.retryCount,
    filesTouchedCount:     m.filesTouchedCount,
    verificationFailCount: m.verificationFailCount,
    toolFailureCount:      m.toolFailureCount,
    runtimeStatus:         m.runtimeStatus,
    runtimeRestarts:       m.runtimeRestarts,
    dependencyCount:       m.dependencyCount,
    agentConfidenceScore:  m.agentConfidenceScore,
    hallucinationRisk:     m.hallucinationRisk,
    reflectionSeverity:    m.reflectionSeverity,
    avgStepMs:             m.stepCount > 0 ? m.stepTotalMs / m.stepCount : 0,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearRunMetrics(runId: string): void { _store.delete(runId); }
