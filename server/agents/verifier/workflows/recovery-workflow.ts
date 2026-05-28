/**
 * workflows/recovery-workflow.ts
 * Orchestrates failure recovery: rollback validation, checkpoint restore.
 */

import type { WorkflowInput, WorkflowResult } from '../types/workflow.types.ts';
import { buildContext, resultError } from '../coordination/dispatcher-client.ts';
import { runTool, runFailureRecovery, VERIFIER_TOOLS } from '../coordination/tool-coordinator.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { eventPublisher } from '../events/event-publisher.ts';

export async function runRecoveryWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const start       = Date.now();
  const context     = buildContext(input.runId, input.projectId, input.sandboxRoot, { workflow: 'recovery' });
  const errors:     string[] = [];
  const inputErrors = input.errors ?? [];
  const base        = { projectId: input.projectId, sandboxRoot: input.sandboxRoot };

  verifierLogger.workflow(input.runId, 'recovery', 'start');
  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'recovery', 'start');

  const recoveryResult = await runFailureRecovery(context, inputErrors);
  if (!recoveryResult.ok) errors.push(`Failure recovery failed: ${resultError(recoveryResult)}`);

  const checkpointResult = await runTool(VERIFIER_TOOLS.CHECKPOINT_VALIDATE, base, context);
  if (!checkpointResult.ok) errors.push(`Checkpoint validation failed: ${resultError(checkpointResult)}`);

  const rollbackResult = await runTool(VERIFIER_TOOLS.ROLLBACK_VALIDATE, { ...base, errors: inputErrors }, context);
  if (!rollbackResult.ok) errors.push(`Rollback validation failed: ${resultError(rollbackResult)}`);

  const durationMs  = Date.now() - start;
  const passed      = errors.length === 0;
  const recoveryData = recoveryResult.ok ? (recoveryResult as { ok: true; data: unknown; durationMs: number }).data : undefined;

  eventPublisher.workflowLifecycle(input.runId, input.projectId, 'recovery', passed ? 'end' : 'fail');
  verifierLogger.workflow(input.runId, 'recovery', passed ? 'end' : 'fail', { durationMs });

  return { runId: input.runId, kind: 'recovery', status: passed ? 'completed' : 'failed', passed, errors, warnings: [], durationMs, data: recoveryData as Record<string, unknown> | undefined };
}
