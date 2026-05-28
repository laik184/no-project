/**
 * diagnostics/failure-analyzer.ts
 * Orchestrates failure analysis by dispatching diagnostic tools.
 */

import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import type { PhaseResult } from '../types/verifier.types.ts';
import type { ParsedError } from '../types/diagnostics.types.ts';
import { analyzeErrors, detectRootCause, buildDiagnosticsReport } from '../coordination/tool-coordinator.ts';
import { resultError } from '../coordination/dispatcher-client.ts';
import { classifyAll } from './error-classifier.ts';
import { buildFailureSummary } from '../utils/diagnostics-utils.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export interface FailureAnalysis {
  classified:  ReturnType<typeof classifyAll>;
  summary:     ReturnType<typeof buildFailureSummary>;
  toolReport?: unknown;
  rawErrors:   string[];
}

export async function analyzePhaseFailures(
  context:      ToolExecutionContext,
  failedPhases: PhaseResult[],
  rawLogs = '',
): Promise<FailureAnalysis> {
  const rawErrors  = failedPhases.flatMap((p) => p.errors);
  const classified = classifyAll(rawErrors);
  const parsed: ParsedError[] = classified.map((c) => ({
    message: c.message, severity: c.severity, category: c.category, raw: c.message,
  }));
  const summary = buildFailureSummary(parsed);

  let toolReport: unknown;

  if (rawErrors.length > 0) {
    const analyzeResult = await analyzeErrors(context, rawLogs || rawErrors.join('\n'));
    if (analyzeResult.ok) {
      const rootResult = await detectRootCause(context, rawErrors);
      if (rootResult.ok) {
        const reportResult = await buildDiagnosticsReport(context, rawErrors, rawLogs);
        if (reportResult.ok) {
          toolReport = (reportResult as { ok: true; data: unknown; durationMs: number }).data;
        }
      }
    } else {
      verifierLogger.warn(context.runId, 'Error analysis tool failed', { error: resultError(analyzeResult) });
    }
  }

  return { classified, summary, toolReport, rawErrors };
}
