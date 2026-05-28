/**
 * server/agents/planner/execution/task-runner.ts
 *
 * Executes a single planning coordinator task through the coordination layer.
 * Handles retry policy selection, outcome assembly, and timing.
 * Pure orchestration — routes to planning-routing, never executes directly.
 */

import type { CoordinatorTask, PlanningTaskOutcome } from '../types/planner.types.ts';
import type { PlanningContext }                       from '../core/planner-context.ts';
import { routePlanningTask }                          from '../coordination/planning-routing.ts';
import { withRetry, PLANNING_RETRY_POLICY }           from './retry-manager.ts';
import { plannerLogger }                              from '../telemetry/planner-logger.ts';

// ── Task runner ───────────────────────────────────────────────────────────────

export async function runPlanningTask(
  task:    CoordinatorTask,
  context: PlanningContext,
): Promise<PlanningTaskOutcome> {
  const { id: taskId, label, timeoutMs } = task;
  const { runId } = context;

  const policy    = { ...PLANNING_RETRY_POLICY };
  const startedAt = Date.now();

  plannerLogger.task(runId, taskId, 'start', { label });

  const retryResult = await withRetry(
    async () => routePlanningTask(task, context, 1),
    { runId, taskId, phase: label, policy },
    (outcome) => outcome.success,
  );

  const durationMs = Date.now() - startedAt;

  if (retryResult.success && retryResult.value) {
    const outcome = retryResult.value;
    plannerLogger.task(runId, taskId, 'complete', { durationMs });
    return {
      taskId,
      phase:      label,
      success:    true,
      durationMs,
      output:     outcome.output,
      attempt:    retryResult.attempts,
    };
  }

  const error = retryResult.lastError ?? 'Planning task failed without error message';
  plannerLogger.task(runId, taskId, 'failed', { error, durationMs });

  return {
    taskId,
    phase:      label,
    success:    false,
    durationMs,
    error,
    attempt:    retryResult.attempts,
  };

  void timeoutMs;
}
