import type { VerificationResult, PhaseResult, VerificationStatus } from '../types/verifier.types.ts';

export function buildVerificationReport(
  runId:      string,
  projectId:  string,
  phases:     PhaseResult[],
  startedAt:  Date,
): VerificationResult {
  const completedAt = new Date();
  const durationMs  = completedAt.getTime() - startedAt.getTime();
  const errorCount  = phases.reduce((n, p) => n + p.errors.length, 0);
  const warningCount = phases.reduce((n, p) => n + p.warnings.length, 0);

  const failed    = phases.filter((p) => p.status === 'failed');
  const overallStatus: VerificationStatus = failed.length > 0 ? 'failed' : 'passed';

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
  const lines = [
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
      lines.push(`      ERROR: ${err}`);
    }
  }

  return lines.join('\n');
}

export function summarizeResult(result: VerificationResult): string {
  const phaseNames = result.phases
    .filter((p) => p.status === 'failed')
    .map((p) => p.phase);

  if (result.overallStatus === 'passed') {
    return `All ${result.phases.length} phase(s) passed in ${result.durationMs}ms`;
  }
  return `Failed phases: ${phaseNames.join(', ')} — ${result.errorCount} total error(s)`;
}
