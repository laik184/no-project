/**
 * ui-validation-report.ts
 * Formats and summarizes UIValidationResult data for reports and logs.
 */

import type { UIValidationResult, UICheck,
              ConsoleError }              from '../types/validation.types.ts';

export interface ValidationReportSummary {
  ok:            boolean;
  url:           string;
  errorCount:    number;
  warningCount:  number;
  crashDetected: boolean;
  consoleErrors: number;
  failedChecks:  string[];
  durationMs:    number;
}

export function buildValidationSummary(result: UIValidationResult): ValidationReportSummary {
  const errors   = result.checks.filter((c) => !c.passed && c.severity === 'error');
  const warnings = result.checks.filter((c) => !c.passed && c.severity === 'warning');

  return {
    ok:            result.ok,
    url:           result.url,
    errorCount:    errors.length,
    warningCount:  warnings.length,
    crashDetected: result.crashDetected,
    consoleErrors: result.consoleErrors.length,
    failedChecks:  errors.map((c) => c.name),
    durationMs:    result.durationMs,
  };
}

export function formatValidationReport(result: UIValidationResult): string {
  const summary = buildValidationSummary(result);
  const status  = summary.ok ? '✓ PASS' : '✗ FAIL';

  const lines = [
    `UI Validation — ${status}`,
    `  URL: ${result.url}`,
    `  Checks: ${result.checks.filter((c) => c.passed).length}/${result.checks.length} passed`,
  ];

  const failures = result.checks.filter((c) => !c.passed);
  for (const f of failures) {
    lines.push(`  [${f.severity.toUpperCase()}] ${f.name}: ${f.detail ?? 'failed'}`);
  }

  if (result.crashDetected) {
    lines.push('  CRASH DETECTED');
  }

  if (result.consoleErrors.length > 0) {
    lines.push(`  Console errors: ${result.consoleErrors.length}`);
    for (const e of result.consoleErrors.slice(0, 5)) {
      lines.push(`    [${e.type}] ${e.message.slice(0, 100)}`);
    }
  }

  lines.push(`  Duration: ${result.durationMs}ms`);
  return lines.join('\n');
}

export function getChecksByStatus(
  checks: UICheck[],
): { passed: UICheck[]; failed: UICheck[] } {
  return {
    passed: checks.filter((c) => c.passed),
    failed: checks.filter((c) => !c.passed),
  };
}

export function groupConsoleErrors(
  errors: ConsoleError[],
): Record<string, ConsoleError[]> {
  const groups: Record<string, ConsoleError[]> = {};
  for (const e of errors) {
    if (!groups[e.type]) groups[e.type] = [];
    groups[e.type].push(e);
  }
  return groups;
}
