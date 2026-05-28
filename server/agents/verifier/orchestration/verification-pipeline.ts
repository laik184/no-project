/**
 * orchestration/verification-pipeline.ts
 * The verification pipeline — assembles result from phase outputs.
 */

import type { VerificationResult, PhaseResult, VerificationStatus } from '../types/verifier.types.ts';
import { countErrors, countWarnings, pickStatus } from '../utils/verification-utils.ts';

export function buildVerificationReport(
  runId:      string,
  projectId:  string,
  phases:     PhaseResult[],
  startedAt:  Date,
  durationMs: number,
): VerificationResult {
  const completedAt  = new Date();
  const errorCount   = countErrors(phases);
  const warningCount = countWarnings(phases);
  const overallStatus: VerificationStatus = phases.some((p) => p.status === 'failed') ? 'failed' : 'passed';

  return {
    runId,
    projectId,
    overallStatus,
    phases,
    startedAt,
    completedAt,
    durationMs,
    errorCount,
    warningCount,
  };
}

export function formatVerificationResult(result: VerificationResult): string {
  const lines: string[] = [
    `=== Verification Result [${result.runId}] ===`,
    `Status:   ${result.overallStatus.toUpperCase()}`,
    `Duration: ${result.durationMs}ms`,
    `Errors:   ${result.errorCount}`,
    `Warnings: ${result.warningCount}`,
    '',
    '--- Phases ---',
  ];

  for (const phase of result.phases) {
    const icon = phase.status === 'passed' ? '✓' : phase.status === 'failed' ? '✗' : '○';
    lines.push(`  ${icon} ${phase.phase} (${phase.durationMs}ms) — ${phase.status}`);
    for (const err of phase.errors.slice(0, 3)) {
      lines.push(`      ERROR: ${err.slice(0, 120)}`);
    }
  }

  return lines.join('\n');
}

export function summarizeResult(result: VerificationResult): string {
  const failedPhases = result.phases.filter((p) => p.status === 'failed').map((p) => p.phase);
  if (result.overallStatus === 'passed') {
    return `All ${result.phases.length} phase(s) passed in ${result.durationMs}ms`;
  }
  return `Failed: ${failedPhases.join(', ')} — ${result.errorCount} error(s) in ${result.durationMs}ms`;
}
