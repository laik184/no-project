/**
 * workflows/diagnostics-workflow.ts
 * Orchestrates diagnostics aggregation after phase failures.
 */

import type { WorkflowInput, WorkflowResult } from '../types/workflow.types.ts';
import { buildContext, resultError } from '../coordination/dispatcher-client.ts';
import { analyzeErrors, detectRootCause, buildDiagnosticsReport } from '../coordination/tool-coordinator.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { eventPublisher } from '../events/event-publisher.ts';

export async function runDiagnosticsWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const start       = Date.now();
  const context     = buildContext(input.runId, input.projectId, input.sandboxRoot, { workflow: 'diagnostics' });
  const errors:     string[] = [];
  const rawLogs     = input.rawOutput ?? '';
  const inputErrors = input.errors ?? [];

  verifierLogger.workflow(input.runId, 'diagnostics', 'start');
  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'diagnostics', 'start');

  const analyzeResult = await analyzeErrors(context, rawLogs);
  if (!analyzeResult.ok) errors.push(`Error analysis failed: ${resultError(analyzeResult)}`);

  const rootCauseResult = await detectRootCause(context, inputErrors);
  if (!rootCauseResult.ok) errors.push(`Root cause detection failed: ${resultError(rootCauseResult)}`);

  const reportResult = await buildDiagnosticsReport(context, inputErrors, rawLogs);
  if (!reportResult.ok) errors.push(`Diagnostics report failed: ${resultError(reportResult)}`);

  const durationMs  = Date.now() - start;
  const passed      = errors.length === 0;
  const reportData  = reportResult.ok ? (reportResult as { ok: true; data: unknown; durationMs: number }).data : undefined;

  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'diagnostics', passed ? 'end' : 'fail');
  verifierLogger.workflow(input.runId, 'diagnostics', passed ? 'end' : 'fail', { durationMs });

  return { runId: input.runId, kind: 'diagnostics', status: passed ? 'completed' : 'failed', passed, errors, warnings: [], durationMs, data: reportData as Record<string, unknown> | undefined };
}
