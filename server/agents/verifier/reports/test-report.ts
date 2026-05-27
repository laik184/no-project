import type { PhaseResult } from '../types/verifier.types.ts';
import type { TestRunResult } from '../testing/test-runner.ts';

export interface TestReport {
  passed:     boolean;
  total:      number;
  failCount:  number;
  summary:    string;
  topErrors:  string[];
  generatedAt: Date;
}

export function buildTestReport(result: TestRunResult): TestReport {
  const topErrors = result.errors.slice(0, 5).map((e) => e.message);

  return {
    passed:      result.passed,
    total:       result.testCount,
    failCount:   result.failCount,
    summary:     result.summary,
    topErrors,
    generatedAt: new Date(),
  };
}

export function toPhaseResult(result: TestRunResult, durationMs: number): PhaseResult {
  return {
    phase:      'tests',
    status:     result.passed ? 'passed' : 'failed',
    durationMs,
    errors:     result.errors.map((e) => e.message),
    warnings:   [],
    output:     result.rawOutput.slice(0, 1000),
  };
}

export function formatTestReport(report: TestReport): string {
  const lines = [
    `Tests: ${report.passed ? 'PASSED' : 'FAILED'}`,
    `Total: ${report.total}  Failed: ${report.failCount}`,
    `Summary: ${report.summary}`,
  ];
  if (report.topErrors.length) {
    lines.push('', 'Failures:');
    report.topErrors.forEach((e) => lines.push(`  ${e}`));
  }
  return lines.join('\n');
}
