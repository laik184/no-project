/**
 * workflows/validation-workflow.ts
 * Orchestrates test and schema validation workflows.
 */

import type { WorkflowInput, WorkflowResult } from '../types/workflow.types.ts';
import { buildContext, resultError } from '../coordination/dispatcher-client.ts';
import { runTool, VERIFIER_TOOLS } from '../coordination/tool-coordinator.ts';
import { eventPublisher } from '../events/event-publisher.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export async function runValidationWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const start   = Date.now();
  const context = buildContext(input.runId, input.projectId, input.sandboxRoot, { workflow: 'validation' });
  const errors:   string[] = [];
  const warnings: string[] = [];
  const base = { projectId: input.projectId, sandboxRoot: input.sandboxRoot };

  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'validation', 'start');

  const testsResult = await runTool(VERIFIER_TOOLS.RUN_TESTS, base, context, { phase: 'tests', timeoutMs: 120_000 });
  if (!testsResult.ok) {
    errors.push(`Tests: ${resultError(testsResult)}`);
  } else {
    const parseResult = await runTool(VERIFIER_TOOLS.PARSE_TESTS, base, context, { phase: 'tests' });
    if (!parseResult.ok) warnings.push(`Test result parsing failed: ${resultError(parseResult)}`);
  }

  const validateResult = await runTool(VERIFIER_TOOLS.VERIFY_VALIDATE, base, context, { phase: 'validation' });
  if (!validateResult.ok) warnings.push(`Verification validation: ${resultError(validateResult)}`);

  const durationMs = Date.now() - start;
  const passed     = errors.length === 0;
  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'validation', passed ? 'end' : 'fail');
  verifierLogger.workflow(input.runId, 'validation', passed ? 'end' : 'fail', { durationMs });

  return { runId: input.runId, kind: 'validation', status: passed ? 'completed' : 'failed', passed, errors, warnings, durationMs };
}
