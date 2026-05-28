/**
 * server/agents/planner/coordination/planning-routing.ts
 *
 * Routes planning coordinator tasks through the dispatcher client.
 * Selects the correct tool and input shape for each planning step.
 * Pure orchestration — no direct execution, no tool implementations.
 */

import type { CoordinatorTask, PlanningTaskOutcome } from '../types/planner.types.ts';
import type { PlanningContext }                       from '../core/planner-context.ts';
import { dispatchTool }                               from './dispatcher-client.ts';
import { plannerLogger }                              from '../telemetry/planner-logger.ts';

// ── Route a single coordinator task ──────────────────────────────────────────

export async function routePlanningTask(
  task:    CoordinatorTask,
  context: PlanningContext,
  attempt: number,
): Promise<PlanningTaskOutcome> {
  const startedAt = Date.now();
  const { runId, toolCtx } = context;

  plannerLogger.task(runId, task.id, `route → ${task.toolName}`, {
    label: task.label, attempt,
  });

  const result = await dispatchTool(
    task.toolName,
    task.input,
    toolCtx,
    { timeoutMs: task.timeoutMs, attempt, label: task.label },
  );

  const durationMs = Date.now() - startedAt;

  if (result.ok) {
    return {
      taskId:     task.id,
      phase:      task.label,
      success:    true,
      durationMs,
      output:     JSON.stringify(result.data).slice(0, 500),
      attempt,
    };
  }

  const errorMsg = (result as { ok: false; error: string }).error ?? 'unknown error';
  return {
    taskId:     task.id,
    phase:      task.label,
    success:    false,
    durationMs,
    error:      errorMsg,
    attempt,
  };
}
