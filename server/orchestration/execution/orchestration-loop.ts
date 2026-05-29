/**
 * server/orchestration/execution/orchestration-loop.ts
 *
 * MAIN orchestration runtime loop.
 * Controls: lifecycle, workflow sequencing, agent coordination,
 * retries, escalation, and result aggregation.
 * Orchestration-only — all execution flows through workflow-runner.
 */

import type {
  OrchestrationRequest,
  OrchestrationResult,
  OrchestrationContext,
  WorkflowResult,
  OrchestrationRetryConfig,
} from '../types/orchestration.types.ts';
import { buildExecutionPlan, orderWorkflows } from '../planning/execution-plan-builder.ts';
import { buildWorkflowExecutionPlan }         from '../routing/workflow-routing.ts';
import { runWorkflow }                        from './workflow-runner.ts';
import { DEFAULT_RETRY_CONFIG }               from './retry-manager.ts';
import { startPlanning, startRunning, markCompleted, markFailed, markEscalated } from '../lifecycle/lifecycle-manager.ts';
import { shouldEscalate, triggerEscalation }  from '../lifecycle/escalation-manager.ts';
import { initiateRecovery, recoveryPlanToDecision } from '../lifecycle/recovery-coordinator.ts';
import { initRunMetrics, finalizeRunMetrics } from '../telemetry/orchestration-metrics.ts';
import { logOrchestrationStarted, logOrchestrationCompleted, logOrchestrationFailed } from '../telemetry/orchestration-logger.ts';
import { publishOrchestrationStarted, publishOrchestrationCompleted, publishOrchestrationFailed } from '../events/event-publisher.ts';
import { registerOrchestration, unregisterOrchestration } from '../monitoring/orchestration-monitor.ts';
import { elapsed } from '../utils/orchestration-utils.ts';

// ── Main loop ─────────────────────────────────────────────────────────────────

export async function runOrchestrationLoop(
  req:       OrchestrationRequest,
  ctx:       OrchestrationContext,
  sessionId: string,
): Promise<OrchestrationResult> {
  const start      = ctx.startedAt;
  const retryConf: OrchestrationRetryConfig = req.options?.retry ?? DEFAULT_RETRY_CONFIG;

  initRunMetrics(ctx.orchestrationId, ctx.runId);
  logOrchestrationStarted(ctx.orchestrationId, ctx.runId, ctx.projectId);
  publishOrchestrationStarted(ctx);

  // ── Planning phase ────────────────────────────────────────────────────────

  const planTransition = startPlanning(ctx, sessionId);
  if (!planTransition.ok) {
    return failResult(ctx, sessionId, planTransition.error ?? 'Failed to start planning', start, []);
  }

  const planResult = buildExecutionPlan(req);
  if (!planResult.ok || !planResult.plan) {
    const err = (planResult.errors ?? ['Plan build failed']).join('; ');
    return failResult(ctx, sessionId, err, start, []);
  }

  const { plan }    = planResult;
  const workflows   = orderWorkflows(plan.workflows);
  const execPlan    = buildWorkflowExecutionPlan(req, workflows);

  registerOrchestration(ctx.orchestrationId, sessionId, ctx.runId, workflows.length);

  // ── Running phase ─────────────────────────────────────────────────────────

  const runTransition = startRunning(ctx, sessionId);
  if (!runTransition.ok) {
    return failResult(ctx, sessionId, runTransition.error ?? 'Failed to start running', start, []);
  }

  const workflowResults: WorkflowResult[] = [];

  for (const wave of execPlan.waves) {
    const waveResults = await Promise.all(
      wave.map(wf => runWorkflow(wf, ctx, retryConf, execPlan.stopOnFail)),
    );

    workflowResults.push(...waveResults);

    const failed = waveResults.filter(r => !r.ok);

    if (failed.length > 0) {
      // Check escalation threshold
      if (shouldEscalate(ctx.runId)) {
        markEscalated(ctx, sessionId);
        triggerEscalation(ctx, `${failed.length} workflow(s) failed in wave`);

        const recovery = initiateRecovery(ctx, 'Escalation triggered — attempting recovery');
        const decision = recoveryPlanToDecision(recovery);

        if (decision.outcome === 'abort') {
          const err = failed[0].error ?? 'Workflow failed';
          return failResult(ctx, sessionId, err, start, workflowResults);
        }
        // For retry/skip strategies: continue loop (recovery handled at phase level)
      } else if (execPlan.stopOnFail) {
        const err = failed[0].error ?? 'Workflow failed';
        return failResult(ctx, sessionId, err, start, workflowResults);
      }
    }
  }

  // ── Completion ────────────────────────────────────────────────────────────

  const completed = workflowResults.filter(r => r.ok).length;
  const failedCount = workflowResults.filter(r => !r.ok).length;
  const durationMs  = elapsed(start);

  markCompleted(ctx, sessionId);
  finalizeRunMetrics(ctx.runId, true);
  unregisterOrchestration(ctx.orchestrationId);

  logOrchestrationCompleted(ctx.orchestrationId, ctx.runId, durationMs, completed);
  publishOrchestrationCompleted(ctx, durationMs, completed);

  return {
    ok:                 failedCount === 0,
    orchestrationId:    ctx.orchestrationId,
    runId:              ctx.runId,
    sessionId,
    workflowsTotal:     workflows.length,
    workflowsCompleted: completed,
    workflowsFailed:    failedCount,
    durationMs,
    results:            workflowResults,
  };
}

// ── Failure builder ───────────────────────────────────────────────────────────

function failResult(
  ctx:       OrchestrationContext,
  sessionId: string,
  error:     string,
  start:     Date,
  results:   WorkflowResult[],
): OrchestrationResult {
  const durationMs = elapsed(start);

  markFailed(ctx, sessionId);
  finalizeRunMetrics(ctx.runId, false);
  unregisterOrchestration(ctx.orchestrationId);

  logOrchestrationFailed(ctx.orchestrationId, ctx.runId, error);
  publishOrchestrationFailed(ctx, error);

  return {
    ok:                 false,
    orchestrationId:    ctx.orchestrationId,
    runId:              ctx.runId,
    sessionId,
    workflowsTotal:     results.length,
    workflowsCompleted: results.filter(r => r.ok).length,
    workflowsFailed:    results.filter(r => !r.ok).length,
    durationMs,
    results,
    error,
  };
}
