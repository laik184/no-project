/**
 * server/agents/verifier/execution/verification-runner.ts
 * Orchestrates running a full set of verification steps.
 */

import type { VerificationStep, VerificationStepResult } from '../types/verifier.types.ts';
import type { VerifierExecutionContext }                   from '../core/verifier-context.ts';
import { verifierState }                                  from '../core/verifier-state.ts';
import { verifierSession }                                from '../core/verifier-session.ts';
import { verifierLogger }                                 from '../telemetry/verifier-logger.ts';
import { runVerificationLoop }                            from './verification-loop.ts';

export interface VerificationRunResult {
  runId:      string;
  success:    boolean;
  outcomes:   VerificationStepResult[];
  durationMs: number;
}

export async function runVerifier(
  steps:   readonly VerificationStep[],
  context: VerifierExecutionContext,
): Promise<VerificationRunResult> {
  const { runId } = context;
  const start     = Date.now();

  verifierLogger.lifecycle(runId, 'run-start', { steps: steps.length });
  verifierState.init(runId, steps.length);
  verifierSession.create(runId, context.projectId);

  let outcomes: VerificationStepResult[];
  try {
    outcomes = await runVerificationLoop(steps, context);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    verifierLogger.error(runId, 'Verification run threw unexpectedly', { error });
    verifierSession.complete(runId, false);
    return {
      runId,
      success:    false,
      outcomes:   verifierState.get(runId)?.results ?? [],
      durationMs: Date.now() - start,
    };
  }

  const success = outcomes.every((o) => o.success || !steps.find((s) => s.id === o.stepId)?.critical);
  verifierSession.complete(runId, success);
  verifierLogger.lifecycle(runId, 'run-complete', { success, steps: outcomes.length, durationMs: Date.now() - start });

  return { runId, success, outcomes, durationMs: Date.now() - start };
}
