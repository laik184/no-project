/**
 * core/verifier-engine.ts
 * The verification execution engine.
 * Drives the plan through the execution loop and manages the run lifecycle.
 */

import type { VerificationResult } from '../types/verifier.types.ts';
import type { VerifierContext } from './verifier-context.ts';
import type { VerificationPlan } from '../planning/verification-planner.ts';
import { runVerificationLoop }  from '../execution/verification-loop.ts';
import { runRecovery }          from '../recovery/recovery-engine.ts';
import { verifierState }        from './verifier-state.ts';
import { openSession, closeSession } from './verifier-session.ts';
import { verificationStore }    from '../state/verification-store.ts';
import { verifierLogger }       from '../telemetry/verifier-logger.ts';
import { verifierMetrics }      from '../telemetry/verifier-metrics.ts';
import { performanceTracker }   from '../telemetry/performance-tracker.ts';
import { eventPublisher }       from '../events/event-publisher.ts';
import { buildVerificationReport } from '../orchestration/verification-pipeline.ts';

export async function executeVerification(
  ctx:  VerifierContext,
  plan: VerificationPlan,
): Promise<VerificationResult> {
  const { runId, projectId } = ctx.input;
  const start = Date.now();

  openSession(ctx.input);
  verifierState.init(runId, projectId);
  performanceTracker.start(runId, 'total');

  verifierLogger.info(runId, 'Engine started', { phases: plan.phases, stepCount: plan.steps.length });
  eventPublisher.verificationStarted(runId, projectId, plan.phases);

  try {
    const { phases, aborted, reason } = await runVerificationLoop(plan, ctx.toolContext);

    const failedPhases = phases.filter((p) => p.status === 'failed');

    if (failedPhases.length > 0 && ctx.config.maxRetries > 0) {
      verifierLogger.info(runId, 'Running recovery after phase failures', { failedCount: failedPhases.length });
      await runRecovery(runId, failedPhases, ctx.toolContext);
    }

    const durationMs = performanceTracker.end(runId, 'total');
    const result     = buildVerificationReport(runId, projectId, phases, ctx.startedAt, durationMs);

    verificationStore.complete(runId, result);
    verifierState.setStatus(runId, result.overallStatus);
    closeSession(runId, result.overallStatus);

    verifierMetrics.recordVerification(runId, durationMs, result.overallStatus === 'passed');
    eventPublisher.verificationCompleted(runId, projectId, result.overallStatus, durationMs, result.errorCount);

    verifierLogger.info(runId, 'Engine completed', {
      status:     result.overallStatus,
      durationMs: result.durationMs,
      errorCount: result.errorCount,
    });

    return result;

  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg   = err instanceof Error ? err.message : String(err);

    verifierLogger.error(runId, 'Engine threw unexpected error', { error: errorMsg });
    verifierState.abort(runId, errorMsg);
    closeSession(runId, 'failed');
    eventPublisher.verificationFailed(runId, projectId, [errorMsg]);

    return {
      runId,
      projectId,
      overallStatus: 'failed',
      phases:        [],
      startedAt:     ctx.startedAt,
      completedAt:   new Date(),
      durationMs,
      errorCount:    1,
      warningCount:  0,
    };
  }
}
