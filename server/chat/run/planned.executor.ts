/**
 * planned.executor.ts
 * Uses the Planner Agent (agents/planner/) to generate a full execution plan.
 */

import { createExecutionPlan, initializePlanner } from '../../agents/planner/planner-agent.ts';
import { ensureProjectDir }                        from '../../infrastructure/sandbox/sandbox.util.ts';
import { emitAgentEvent, withRunLifecycle }        from './run-lifecycle.ts';
import type { RunHandle, RunInput }                from './types.ts';

export async function executePlannedRun(handle: RunHandle, input: RunInput): Promise<void> {
  const { runId, projectId } = handle;

  emitAgentEvent({
    runId, projectId, phase: 'planner',
    eventType: 'phase.started',
    payload: { goal: input.goal, mode: 'planned' },
    ts: Date.now(),
  });

  return withRunLifecycle(handle, 'planner', async () => {
    await ensureProjectDir(projectId);

    initializePlanner();

    const result = await createExecutionPlan({
      runId,
      projectId,
      goal:      input.goal,
      timeoutMs: 55_000,
    });

    if (!result.ok || !result.plan) {
      throw new Error(result.error ?? 'Planner agent returned no plan');
    }

    const { plan } = result;

    emitAgentEvent({
      runId, projectId, phase: 'planner',
      eventType: 'phase.completed',
      payload: {
        planId:     plan.planId,
        appType:    plan.appType,
        complexity: plan.complexity,
        phases:     plan.phases.length,
        totalSteps: plan.tasks.length,
        durationMs: result.durationMs,
      },
      ts: Date.now(),
    });

    return {
      success: true,
      result: {
        planned:      true,
        planId:       plan.planId,
        appType:      plan.appType,
        complexity:   plan.complexity,
        phases:       plan.phases.length,
        totalSteps:   plan.tasks.length,
        durationMs:   result.durationMs,
        overallSuccess: plan.validationResults.valid,
      },
    };
  });
}
