import type { PhaseResult } from '../types/verifier.types.ts';
import type { BuildRunResult } from '../build/build-runner.ts';
import { formatBuildAnalysis } from '../build/build-output-analyzer.ts';

export interface BuildReport {
  passed:      boolean;
  errorCount:  number;
  summary:     string;
  topErrors:   string[];
  analysis:    string;
  generatedAt: Date;
}

export function buildBuildReport(result: BuildRunResult): BuildReport {
  const topErrors = result.errors.slice(0, 5).map((e) => e.message);
  const analysis  = formatBuildAnalysis(result.analysis);

  return {
    passed:     result.passed,
    errorCount: result.errors.length,
    summary:    result.passed
      ? 'Build completed successfully'
      : `Build failed with ${result.errors.length} error(s)`,
    topErrors,
    analysis,
    generatedAt: new Date(),
  };
}

export function toPhaseResult(result: BuildRunResult, durationMs: number): PhaseResult {
  return {
    phase:      'build',
    status:     result.passed ? 'passed' : 'failed',
    durationMs,
    errors:     result.errors.map((e) => e.message),
    warnings:   [],
    output:     result.stdout.slice(0, 1000),
  };
}

export function formatBuildReport(report: BuildReport): string {
  const lines = [
    `Build: ${report.passed ? 'PASSED' : 'FAILED'}`,
    `Errors: ${report.errorCount}`,
    '',
    report.analysis,
  ];
  if (report.topErrors.length) {
    lines.push('', 'Top errors:');
    report.topErrors.forEach((e) => lines.push(`  ${e}`));
  }
  return lines.join('\n');
}
