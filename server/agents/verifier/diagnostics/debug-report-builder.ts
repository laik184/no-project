import type { DiagnosticsReport, ParsedError, RootCause } from '../types/diagnostics.types.ts';
import { buildErrorContext, formatStackTrace } from '../utils/diagnostics-utils.ts';
import { parseStackTrace } from './stacktrace-parser.ts';
import { detectRootCauses } from './rootcause-detector.ts';

export function buildDebugReport(
  runId:   string,
  errors:  ParsedError[],
  rawLogs: string = '',
): DiagnosticsReport {
  const rootCauses = detectRootCauses(errors);

  const severity = errors.some((e) => e.severity === 'fatal') ? 'fatal'
    : errors.some((e) => e.severity === 'error') ? 'error'
    : errors.some((e) => e.severity === 'warning') ? 'warning'
    : 'info';

  const summary = buildSummary(errors, rootCauses, rawLogs);

  return { runId, errors, rootCauses, summary, severity, generatedAt: new Date() };
}

export function formatDebugReport(report: DiagnosticsReport): string {
  const lines: string[] = [
    `=== Debug Report [${report.runId}] ===`,
    `Severity:   ${report.severity.toUpperCase()}`,
    `Generated:  ${report.generatedAt.toISOString()}`,
    '',
    '--- Errors ---',
    ...report.errors.map((e) => buildErrorContext(e)),
    '',
    '--- Root Causes ---',
    ...report.rootCauses.map(formatRootCause),
    '',
    `Summary: ${report.summary}`,
  ];
  return lines.join('\n');
}

function formatRootCause(rc: RootCause): string {
  const lines = [
    `[${rc.category.toUpperCase()}] ${rc.description}`,
    `  Primary:  ${rc.primaryError}`,
  ];
  if (rc.suggestedFix) lines.push(`  Fix:      ${rc.suggestedFix}`);
  return lines.join('\n');
}

function buildSummary(errors: ParsedError[], causes: RootCause[], _rawLogs: string): string {
  if (errors.length === 0) return 'No errors detected';
  const topCause = causes[0];
  return topCause
    ? `${errors.length} error(s) — primary: ${topCause.category} (${topCause.primaryError.slice(0, 80)})`
    : `${errors.length} error(s) detected`;
}

export function extractStackTraceFromLogs(raw: string): string {
  const start = raw.search(/at .+:\d+/);
  if (start === -1) return '';
  const end = raw.indexOf('\n\n', start);
  const traceRaw = end === -1 ? raw.slice(start) : raw.slice(start, end);
  const parsed   = parseStackTrace(traceRaw);
  return formatStackTrace(parsed.frames);
}
