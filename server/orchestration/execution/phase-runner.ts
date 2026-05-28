/**
 * server/orchestration/execution/phase-runner.ts
 *
 * Executes orchestration phases by coordinating with the agent-coordinator.
 * Manages the phase lifecycle: start → dispatch → retry → complete/fail.
 * Orchestration-only — all execution flows through dispatcher-client.
 */

import type {
  Phase,
  PhaseResult,
  OrchestrationContext,
  OrchestrationRetryConfig,
} from '../types/orchestration.types.ts';
import { dispatchPhaseToAgent }  from '../coordination/agent-coordinator.ts';
import { toToolContext }         from '../core/orchestration-context.ts';
import { recordFailure }         from '../monitoring/failure-monitor.ts';
import { setActivePhase }        from '../monitoring/orchestration-monitor.ts';
import { recordRetry, recordPhaseStarted, recordPhaseCompleted, recordPhaseFailed } from '../telemetry/orchestration-metrics.ts';
import { logPhaseStarted, logPhaseCompleted, logPhaseFailed, logPhaseRetrying, logPhaseSkipped } from '../telemetry/orchestration-logger.ts';
import { publishPhaseStarted, publishPhaseCompleted, publishPhaseFailed } from '../events/event-publisher.ts';
import {
  createRetryState,
  advanceRetry,
  canRetry,
  applyRetryDelay,
  buildRetryDecision,
  DEFAULT_RETRY_CONFIG,
} from './retry-manager.ts';

// ── Phase runner ──────────────────────────────────────────────────────────────

export async function runPhase(
  phase:      Phase,
  workflowId: string,
  ctx:        OrchestrationContext,
  config:     OrchestrationRetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<PhaseResult> {
  const toolCtx   = toToolContext(ctx, { workflowId, phaseId: phase.phaseId });
  let retryState  = createRetryState(phase.phaseId, config);

  recordPhaseStarted(ctx.runId);
  setActivePhase(ctx.orchestrationId, phase.phaseId);

  while (true) {
    const attempt = retryState.attempt;

    logPhaseStarted(ctx.orchestrationId, phase.phaseId, phase.name, phase.agentType, attempt);
    publishPhaseStarted(ctx, workflowId, phase.phaseId, phase.name, phase.agentType, attempt);

    const result = await dispatchPhaseToAgent(phase, toolCtx, attempt);

    if (result.ok) {
      recordPhaseCompleted(ctx.runId);
      logPhaseCompleted(ctx.orchestrationId, phase.phaseId, result.durationMs);
      publishPhaseCompleted(ctx, workflowId, result);
      return result;
    }

    const error   = result.error ?? 'Unknown error';
    const decision = buildRetryDecision(result, retryState, phase.optional ?? false);

    logPhaseFailed(ctx.orchestrationId, phase.phaseId, error, attempt);
    publishPhaseFailed(ctx, workflowId, phase.phaseId, error, attempt);

    recordFailure(
      ctx.orchestrationId,
      ctx.runId,
      error,
      attempt,
      phase.phaseId,
      workflowId,
      phase.agentType,
    );

    if (decision.outcome === 'skip') {
      logPhaseSkipped(ctx.orchestrationId, phase.phaseId, decision.reason);
      recordPhaseCompleted(ctx.runId);
      return { ...result, ok: true, error: undefined };
    }

    if (decision.outcome === 'abort' || !canRetry(retryState)) {
      recordPhaseFailed(ctx.runId);
      return result;
    }

    // Retry path
    retryState = advanceRetry(retryState, error);
    recordRetry(ctx.runId);
    logPhaseRetrying(ctx.orchestrationId, phase.phaseId, retryState.attempt, config.delayMs);
    await applyRetryDelay(retryState.attempt, config);
  }
}
