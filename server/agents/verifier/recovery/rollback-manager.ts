/**
 * recovery/rollback-manager.ts
 * Manages rollback decisions and coordinates rollback validation through tools.
 */

import type { VerificationPhase, PhaseResult } from '../types/verifier.types.ts';
import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import { runTool, VERIFIER_TOOLS } from '../coordination/tool-coordinator.ts';
import { resultError } from '../coordination/dispatcher-client.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export type RollbackDecision = 'rollback' | 'continue' | 'abort';

export interface RollbackResult {
  decision:   RollbackDecision;
  validated:  boolean;
  errors:     string[];
  durationMs: number;
}

const ROLLBACK_THRESHOLD_ERRORS = 3;

export function decideRollback(failedPhases: PhaseResult[], errorCount: number): RollbackDecision {
  if (errorCount === 0) return 'continue';
  if (errorCount > 10)  return 'abort';
  const hasCritical = failedPhases.some((p) => p.phase === 'build' || p.phase === 'runtime');
  return hasCritical && errorCount >= ROLLBACK_THRESHOLD_ERRORS ? 'rollback' : 'continue';
}

export async function executeRollbackValidation(
  context:      ToolExecutionContext,
  failedPhases: VerificationPhase[],
): Promise<RollbackResult> {
  const start = Date.now();
  verifierLogger.info(context.runId, 'Rollback validation starting', { phases: failedPhases });

  const result = await runTool(
    VERIFIER_TOOLS.ROLLBACK_VALIDATE,
    { projectId: context.projectId, sandboxRoot: context.sandboxRoot, failedPhases },
    context,
  );
  const durationMs = Date.now() - start;

  if (!result.ok) {
    const errMsg = resultError(result);
    verifierLogger.error(context.runId, 'Rollback validation failed', { error: errMsg });
    return { decision: 'abort', validated: false, errors: [errMsg], durationMs };
  }

  verifierLogger.info(context.runId, 'Rollback validation completed', { durationMs });
  return { decision: 'rollback', validated: true, errors: [], durationMs };
}
