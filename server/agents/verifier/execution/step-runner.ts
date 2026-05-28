/**
 * server/agents/verifier/execution/step-runner.ts
 *
 * Executes ONE verification step by routing it through:
 * verification-routing → tool-coordinator → dispatcher-client → tool registry
 *
 * Pure orchestration: VerificationStep → VerificationStepResult.
 * No spawn, exec, shell, fetch, or direct tool logic.
 */

import type { VerificationStep, VerificationStepResult } from '../types/verifier.types.ts';
import type { ToolExecutionContext }                       from '../../../tools/registry/tool-types.ts';
import { routeVerificationStep }                          from '../coordination/verification-routing.ts';
import { withRetry, policyForStepType }                   from './retry-manager.ts';
import { verifierLogger }                                 from '../telemetry/verifier-logger.ts';
import { elapsedMs }                                      from '../utils/verification-utils.ts';

export async function runVerificationStep(
  step:    VerificationStep,
  context: ToolExecutionContext,
): Promise<VerificationStepResult> {
  const startedAt = new Date();
  const policy    = policyForStepType(step.type);

  verifierLogger.step(context.runId, step.id, 'start', { type: step.type, phase: step.phase, label: step.label });

  const retryResult = await withRetry(
    () => routeVerificationStep(step, context),
    { runId: context.runId, stepId: step.id, policy },
    (r) => r.success,
  );

  const durationMs = elapsedMs(startedAt);
  const attempt    = retryResult.attempts;

  const outcome: VerificationStepResult = retryResult.success && retryResult.value
    ? {
        stepId:  step.id,
        phase:   step.phase,
        success: true,
        durationMs,
        attempt,
        output:  retryResult.value.output,
      }
    : {
        stepId:  step.id,
        phase:   step.phase,
        success: false,
        durationMs,
        attempt,
        error:   retryResult.lastError ?? 'Step failed',
      };

  verifierLogger.step(context.runId, step.id, outcome.success ? 'complete' : 'fail', {
    durationMs, attempt, error: outcome.error,
  });

  return outcome;
}
