import type { RawTypeError } from './type-error-parser.ts';
import type { ClassifiedError } from './type-error-classifier.ts';
import { classifyAll, groupByClass } from './type-error-classifier.ts';

export interface TypecheckReport {
  passed:       boolean;
  errorCount:   number;
  warningCount: number;
  summary:      string;
  byClass:      Partial<Record<string, ClassifiedError[]>>;
  topErrors:    string[];
}

export function buildTypecheckReport(
  rawErrors: RawTypeError[],
  exitCode:  number,
): TypecheckReport {
  const classified = classifyAll(rawErrors);
  const byClass    = groupByClass(classified);

  const errors   = rawErrors.filter((e) => e.isError);
  const warnings = rawErrors.filter((e) => !e.isError);
  const passed   = exitCode === 0 && errors.length === 0;

  const topErrors = errors
    .slice(0, 5)
    .map((e) => `${e.file}(${e.line}): ${e.code} — ${e.message}`);

  const summary = passed
    ? 'TypeScript check passed with no errors'
    : `${errors.length} type error(s), ${warnings.length} warning(s)`;

  return {
    passed,
    errorCount:   errors.length,
    warningCount: warnings.length,
    summary,
    byClass,
    topErrors,
  };
}

export function formatTypecheckReport(report: TypecheckReport): string {
  const lines = [
    `TypeScript Check: ${report.passed ? 'PASSED' : 'FAILED'}`,
    `Errors: ${report.errorCount}  Warnings: ${report.warningCount}`,
  ];
  if (report.topErrors.length) {
    lines.push('', 'Top errors:');
    report.topErrors.forEach((e) => lines.push(`  ${e}`));
  }
  return lines.join('\n');
}
