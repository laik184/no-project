/**
 * recovery/recovery-engine.ts
 * Top-level recovery orchestrator — coordinates retry, rollback, and checkpoint.
 */

import type { PhaseResult, VerificationPhase } from '../types/verifier.types.ts';
import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import { decidePhaseRetry, clearRetries } from './retry-recovery.ts';
import { decideRollback, executeRollbackValidation } from './rollback-manager.ts';
import { validateAndRestoreCheckpoint } from './checkpoint-recovery.ts';
import { runRecoveryWorkflow } from '../workflows/recovery-workflow.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { eventPublisher } from '../events/event-publisher.ts';

export type RecoveryAction = 'retry' | 'rollback' | 'checkpoint' | 'abort' | 'none';

export interface RecoveryOutcome {
  action:    RecoveryAction;
  success:   boolean;
  errors:    string[];
  durationMs: number;
}

export async function runRecovery(
  runId:        string,
  failedPhases: PhaseResult[],
  context:      ToolExecutionContext,
): Promise<RecoveryOutcome> {
  const start = Date.now();
  const errors: string[] = [];

  verifierLogger.info(runId, 'Recovery engine activated', { failedCount: failedPhases.length });
  eventPublisher.workflowLifecycle(runId, context.projectId, 'recovery', 'start');

  const errorCount = failedPhases.reduce((n, p) => n + p.errors.length, 0);
  const rollbackDecision = decideRollback(failedPhases, errorCount);

  if (rollbackDecision === 'abort') {
    verifierLogger.error(runId, 'Recovery aborted — too many errors', { errorCount });
    return { action: 'abort', success: false, errors: ['Too many errors to recover'], durationMs: Date.now() - start };
  }

  if (rollbackDecision === 'rollback') {
    const phases = failedPhases.map((p) => p.phase);
    const rollback = await executeRollbackValidation(context, phases);
    if (!rollback.validated) errors.push(...rollback.errors);
  }

  const checkpointResult = await validateAndRestoreCheckpoint(context);
  if (!checkpointResult.restored) errors.push(...checkpointResult.errors);

  const workflowResult = await runRecoveryWorkflow({
    runId:       runId,
    projectId:   context.projectId,
    sandboxRoot: context.sandboxRoot,
    kind:        'recovery',
    errors:      failedPhases.flatMap((p) => p.errors),
  });
  if (!workflowResult.passed) errors.push(...workflowResult.errors);

  const durationMs = Date.now() - start;
  const success    = errors.length === 0;
  const action: RecoveryAction = rollbackDecision === 'rollback' ? 'rollback' : 'checkpoint';

  eventPublisher.workflowLifecycle(runId, context.projectId, 'recovery', success ? 'end' : 'fail');
  verifierLogger.info(runId, `Recovery ${success ? 'succeeded' : 'failed'}`, { action, durationMs });

  clearRetries(runId);
  return { action, success, errors, durationMs };
}
