/**
 * execution/verification-loop.ts
 * The core phase iteration loop — drives the verification state machine.
 */

import type { VerificationPhase, PhaseResult } from '../types/verifier.types.ts';
import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import type { VerificationPlan } from '../planning/verification-planner.ts';
import { runPhase } from './verification-runner.ts';
import { skippedPhaseResult } from '../utils/verification-utils.ts';
import { orderedPhases, shouldSkipPhase } from '../utils/planning-utils.ts';
import { eventPublisher } from '../events/event-publisher.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { performanceTracker } from '../telemetry/performance-tracker.ts';
import { verificationStore } from '../state/verification-store.ts';

export interface LoopResult {
  phases:   PhaseResult[];
  aborted:  boolean;
  reason?:  string;
}

export async function runVerificationLoop(
  plan:    VerificationPlan,
  context: ToolExecutionContext,
): Promise<LoopResult> {
  const phases      = orderedPhases(plan.phases);
  const results:    PhaseResult[] = [];
  let aborted       = false;
  let abortReason: string | undefined;

  for (const phase of phases) {
    const completed = results.map((r) => ({ phase: r.phase, status: r.status }));

    if (shouldSkipPhase(phase, completed, plan.stopOnFailure)) {
      verifierLogger.phase(context.runId, phase, 'skip', { reason: 'previous phase failed' });
      eventPublisher.phaseSkipped(context.runId, phase);
      results.push(skippedPhaseResult(phase));
      continue;
    }

    performanceTracker.startPhase(context.runId, phase);
    eventPublisher.phaseStarted(context.runId, phase);

    const phaseSteps = plan.steps.filter((s) => s.phase === phase);
    const phaseResult = await runPhase(phase, phaseSteps, context);
    const durationMs = performanceTracker.endPhase(context.runId, phase);

    const result: PhaseResult = { ...phaseResult, durationMs };
    results.push(result);
    verificationStore.addPhaseResult(context.runId, result);

    if (result.status === 'failed') {
      eventPublisher.phaseFailed(context.runId, phase, result.errors, durationMs);
      if (plan.stopOnFailure) {
        aborted     = true;
        abortReason = `Phase "${phase}" failed`;
        break;
      }
    } else {
      eventPublisher.phaseCompleted(context.runId, phase, durationMs);
    }
  }

  return { phases: results, aborted, reason: abortReason };
}
