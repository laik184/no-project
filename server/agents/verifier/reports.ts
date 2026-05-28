import type {
  VerificationResult, PhaseResult, VerificationStatus,
  ParsedError, DiagnosticsReport,
} from './types.ts';
import { buildErrorContext } from './utils.ts';

export function buildVerificationReport(
  runId:     string,
  projectId: string,
  phases:    PhaseResult[],
  startedAt: Date,
): VerificationResult {
  const completedAt  = new Date();
  const durationMs   = completedAt.getTime() - startedAt.getTime();
  const errorCount   = phases.reduce((n, p) => n + p.errors.length, 0);
  const warningCount = phases.reduce((n, p) => n + p.warnings.length, 0);
  const failed       = phases.filter((p) => p.status === 'failed');
  const overallStatus: VerificationStatus = failed.length > 0 ? 'failed' : 'passed';
  return { runId, projectId, overallStatus, phases, startedAt, completedAt, durationMs, errorCount, warningCount };
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
    for (const err of phase.errors.slice(0, 3)) lines.push(`      ERROR: ${err}`);
  }
  return lines.join('\n');
}

export function summarizeResult(result: VerificationResult): string {
  const failedPhases = result.phases.filter((p) => p.status === 'failed').map((p) => p.phase);
  if (result.overallStatus === 'passed') {
    return `All ${result.phases.length} phase(s) passed in ${result.durationMs}ms`;
  }
  return `Failed phases: ${failedPhases.join(', ')} — ${result.errorCount} total error(s)`;
}

export interface BuildReport {
  passed: boolean; errorCount: number; summary: string;
  topErrors: string[]; analysis: string; generatedAt: Date;
}

export interface RuntimeReport {
  healthy: boolean; serverState: string; endpointsPassed: number;
  endpointsFailed: number; errors: string[]; summary: string; generatedAt: Date;
}

export interface TestReport {
  passed: boolean; total: number; failCount: number;
  summary: string; topErrors: string[]; generatedAt: Date;
}

export interface DiagnosticsReportSummary {
  errorCount: number; rootCauses: number; severity: string;
  summary: string; formatted: string; generatedAt: Date;
}

export function buildBuildPhaseResult(
  passed: boolean, errors: ParsedError[], stdout: string, durationMs: number,
): PhaseResult {
  return {
    phase: 'build', status: passed ? 'passed' : 'failed', durationMs,
    errors: errors.map((e) => e.message), warnings: [], output: stdout.slice(0, 1000),
  };
}

export function buildRuntimePhaseResult(
  healthy: boolean, errors: string[], durationMs: number,
): PhaseResult {
  return { phase: 'runtime', status: healthy ? 'passed' : 'failed', durationMs, errors, warnings: [] };
}

export function buildTestPhaseResult(
  passed: boolean, errors: ParsedError[], rawOutput: string, durationMs: number,
): PhaseResult {
  return {
    phase: 'tests', status: passed ? 'passed' : 'failed', durationMs,
    errors: errors.map((e) => e.message), warnings: [], output: rawOutput.slice(0, 1000),
  };
}

export function buildDiagnosticsReportSummary(
  runId: string, errors: ParsedError[], formatted: string,
): DiagnosticsReportSummary {
  const fatal = errors.some((e) => e.severity === 'fatal') ? 'fatal'
    : errors.some((e) => e.severity === 'error') ? 'error'
    : errors.some((e) => e.severity === 'warning') ? 'warning'
    : 'info';
  const summary = errors.length === 0 ? 'No errors detected'
    : `${errors.length} error(s) detected`;
  return { errorCount: errors.length, rootCauses: 0, severity: fatal, summary, formatted, generatedAt: new Date() };
}

export function mergeDiagnosticsReports(
  reports: DiagnosticsReport[],
): Omit<DiagnosticsReport, 'runId' | 'generatedAt'> {
  const allErrors     = reports.flatMap((r) => r.errors);
  const allRootCauses = reports.flatMap((r) => r.rootCauses);
  const order         = ['info', 'warning', 'error', 'fatal'] as const;
  const severity      = reports.reduce<DiagnosticsReport['severity']>(
    (max, r) => order.indexOf(r.severity) > order.indexOf(max) ? r.severity : max, 'info',
  );
  return {
    errors: allErrors, rootCauses: allRootCauses,
    summary: `${allErrors.length} total error(s) across ${reports.length} run(s)`, severity,
  };
}
