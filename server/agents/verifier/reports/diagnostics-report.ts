import type { DiagnosticsReport } from '../types/diagnostics.types.ts';
import { buildDebugReport, formatDebugReport } from '../diagnostics/debug-report-builder.ts';
import type { ParsedError } from '../types/diagnostics.types.ts';

export interface DiagnosticsReportSummary {
  errorCount:    number;
  rootCauses:    number;
  severity:      string;
  summary:       string;
  formatted:     string;
  generatedAt:   Date;
}

export function buildDiagnosticsReportSummary(
  runId:   string,
  errors:  ParsedError[],
  rawLogs: string = '',
): DiagnosticsReportSummary {
  const report    = buildDebugReport(runId, errors, rawLogs);
  const formatted = formatDebugReport(report);

  return {
    errorCount:  report.errors.length,
    rootCauses:  report.rootCauses.length,
    severity:    report.severity,
    summary:     report.summary,
    formatted,
    generatedAt: report.generatedAt,
  };
}

export function mergeDiagnosticsReports(
  reports: DiagnosticsReport[],
): Omit<DiagnosticsReport, 'runId' | 'generatedAt'> {
  const allErrors     = reports.flatMap((r) => r.errors);
  const allRootCauses = reports.flatMap((r) => r.rootCauses);
  const severity      = reports.reduce<DiagnosticsReport['severity']>((max, r) => {
    const order = ['info', 'warning', 'error', 'fatal'] as const;
    return order.indexOf(r.severity) > order.indexOf(max) ? r.severity : max;
  }, 'info');

  return {
    errors:     allErrors,
    rootCauses: allRootCauses,
    summary:    `${allErrors.length} total error(s) across ${reports.length} run(s)`,
    severity,
  };
}
