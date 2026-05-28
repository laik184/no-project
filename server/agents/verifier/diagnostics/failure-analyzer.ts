/**
 * server/agents/verifier/diagnostics/failure-analyzer.ts
 * Analyzes patterns in verification failures to surface actionable insights.
 */

import type { VerificationStepResult } from '../types/verifier.types.ts';
import { failureMonitor }               from '../monitoring/failure-monitor.ts';

export interface FailureAnalysis {
  runId:            string;
  totalFailures:    number;
  criticalPhases:   string[];
  repeatFailures:   Array<{ stepId: string; count: number }>;
  hasCrashLoop:     boolean;
  recommendation:   string;
}

export function analyzeFailures(runId: string, results: VerificationStepResult[]): FailureAnalysis {
  const failed        = results.filter((r) => !r.success);
  const criticalPhases = [...new Set(failed.map((r) => r.phase))];
  const hasCrashLoop  = failureMonitor.isCrashLooping(runId);
  const retryCount    = failureMonitor.retryCount(runId);

  const stepCounts    = new Map<string, number>();
  for (const r of failed) {
    stepCounts.set(r.stepId, (stepCounts.get(r.stepId) ?? 0) + 1);
  }
  const repeatFailures = [...stepCounts.entries()]
    .filter(([, c]) => c > 1)
    .map(([stepId, count]) => ({ stepId, count }))
    .sort((a, b) => b.count - a.count);

  let recommendation = 'Review error output for each failed phase.';
  if (hasCrashLoop)              recommendation = 'Crash loop detected — check for infinite retry or misconfigured tooling.';
  else if (criticalPhases.includes('typecheck')) recommendation = 'Fix TypeScript errors first — they cascade to build failures.';
  else if (criticalPhases.includes('build'))     recommendation = 'Fix build errors before running tests or runtime checks.';
  else if (criticalPhases.includes('runtime'))   recommendation = 'Server health check failed — verify port config and startup command.';

  return {
    runId,
    totalFailures:   failed.length,
    criticalPhases,
    repeatFailures,
    hasCrashLoop,
    recommendation,
  };
}
