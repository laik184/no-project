/**
 * diagnostics/diagnostics-builder.ts
 * Builds DiagnosticsReport by orchestrating tool calls and heuristic analysis.
 */

import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import type { DiagnosticsReport, ParsedError } from '../types/diagnostics.types.ts';
import type { PhaseResult } from '../types/verifier.types.ts';
import { detectRootCausesAsync } from './rootcause-detector.ts';
import { classifyAll } from './error-classifier.ts';
import { buildFailureSummary, highestSeverity, deduplicateErrors } from '../utils/diagnostics-utils.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export async function buildDiagnosticsReportFromPhases(
  context:      ToolExecutionContext,
  failedPhases: PhaseResult[],
  rawLogs = '',
): Promise<DiagnosticsReport> {
  const allErrors = deduplicateErrors(
    failedPhases
      .flatMap((p) => p.errors)
      .map((msg): ParsedError => {
        const classified = classifyAll([msg])[0];
        return { message: msg, severity: classified.severity, category: classified.category, raw: msg };
      }),
  );

  const rootCauses = await detectRootCausesAsync(context, allErrors.map((e) => e.message));
  const severity   = highestSeverity(allErrors);
  const summary    = buildFailureSummary(allErrors);

  const summaryText = allErrors.length === 0
    ? 'No errors detected'
    : summary.hasCritical
    ? `${summary.total} error(s) — primary: ${rootCauses[0]?.category ?? 'unknown'}`
    : `${summary.warnings} warning(s)`;

  verifierLogger.info(context.runId, 'Diagnostics report built', {
    errorCount: allErrors.length,
    rootCauses: rootCauses.length,
    severity,
  });

  return {
    runId:       context.runId,
    errors:      allErrors,
    rootCauses,
    summary:     summaryText,
    severity,
    generatedAt: new Date(),
  };
}

export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  const lines = [
    `=== Diagnostics Report [${report.runId}] ===`,
    `Severity:  ${report.severity.toUpperCase()}`,
    `Errors:    ${report.errors.length}`,
    `RootCauses:${report.rootCauses.length}`,
    '',
    '--- Root Causes ---',
    ...report.rootCauses.map((rc) =>
      [`[${rc.category.toUpperCase()}] ${rc.description}`, `  Primary: ${rc.primaryError.slice(0, 100)}`, rc.suggestedFix ? `  Fix: ${rc.suggestedFix}` : ''].filter(Boolean).join('\n'),
    ),
    '',
    `Summary: ${report.summary}`,
  ];
  return lines.join('\n');
}
