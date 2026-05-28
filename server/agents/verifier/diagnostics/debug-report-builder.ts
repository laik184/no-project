import type { DiagnosticsReport, ParsedError, RootCause, FailureCategory } from '../types.ts';
import { buildErrorContext, formatStackTrace, highestSeverity } from '../utils.ts';
import { parseLines } from '../utils.ts';
import { groupByCategory } from './classifier.ts';

const FRAME_PATTERN = /at (?:(.+?) \()?(.+?):(\d+)(?::(\d+))?\)?$/;
const ERROR_PATTERN = /^(\w+(?:Error|Exception)?): (.+)$/;

export function parseStackTrace(raw: string) {
  const lines   = parseLines(raw);
  const frames: Array<{ file: string; line: number; column?: number; functionName?: string }> = [];
  let message   = 'Unknown error';
  let errorType = 'Error';

  for (const line of lines) {
    const errorMatch = line.match(ERROR_PATTERN);
    if (errorMatch && frames.length === 0) { errorType = errorMatch[1]; message = errorMatch[2]; continue; }
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;
    const frameMatch = trimmed.match(FRAME_PATTERN);
    if (!frameMatch) continue;
    frames.push({
      functionName: frameMatch[1] ?? undefined,
      file:         frameMatch[2],
      line:         parseInt(frameMatch[3], 10),
      column:       frameMatch[4] ? parseInt(frameMatch[4], 10) : undefined,
    });
  }
  return { message, errorType, frames, raw };
}

const FIX_SUGGESTIONS: Partial<Record<FailureCategory, string>> = {
  typecheck: 'Run `tsc --noEmit` to inspect all type errors. Check import paths and type annotations.',
  build:     'Inspect build config (vite.config.ts / tsconfig.json). Ensure all dependencies are installed.',
  runtime:   'Ensure all required env vars are set. Verify module paths and node_modules installation.',
  test:      'Check test setup. Inspect failing assertions and ensure test database/mocks are initialized.',
  network:   'Verify server is listening on the expected port. Check firewall / CORS settings.',
  config:    'Ensure .env file is present. Verify all required environment variables are set.',
  unknown:   'Inspect full output logs. Enable verbose logging to locate the root issue.',
};

export function detectRootCauses(errors: ParsedError[]): RootCause[] {
  const groups = groupByCategory(errors);
  return (Object.entries(groups) as [FailureCategory, ParsedError[]][]).map(([category, categoryErrors]) => ({
    category,
    description:   `${categoryErrors.length} ${category} error(s) detected`,
    primaryError:  categoryErrors[0].message,
    relatedErrors: categoryErrors.slice(1).map((e) => e.message),
    suggestedFix:  FIX_SUGGESTIONS[category],
  }));
}

export function buildDebugReport(runId: string, errors: ParsedError[], rawLogs = ''): DiagnosticsReport {
  const rootCauses = detectRootCauses(errors);
  const severity   = highestSeverity(errors);
  const topCause   = rootCauses[0];
  const summary    = errors.length === 0 ? 'No errors detected'
    : topCause
    ? `${errors.length} error(s) — primary: ${topCause.category} (${topCause.primaryError.slice(0, 80)})`
    : `${errors.length} error(s) detected`;
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
    ...report.rootCauses.map((rc) => {
      const parts = [`[${rc.category.toUpperCase()}] ${rc.description}`, `  Primary:  ${rc.primaryError}`];
      if (rc.suggestedFix) parts.push(`  Fix:      ${rc.suggestedFix}`);
      return parts.join('\n');
    }),
    '',
    `Summary: ${report.summary}`,
  ];
  return lines.join('\n');
}

export function extractStackTraceFromLogs(raw: string): string {
  const start = raw.search(/at .+:\d+/);
  if (start === -1) return '';
  const end      = raw.indexOf('\n\n', start);
  const traceRaw = end === -1 ? raw.slice(start) : raw.slice(start, end);
  const parsed   = parseStackTrace(traceRaw);
  return formatStackTrace(parsed.frames);
}
