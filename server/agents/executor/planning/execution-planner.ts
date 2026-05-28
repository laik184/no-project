/**
 * server/agents/executor/planning/execution-planner.ts
 *
 * Builds the execution strategy for a run.
 * Validates the plan, resolves ordering, and produces a BuiltExecutionPlan.
 * No execution logic — orchestration and planning only.
 */

import type {
  ExecutionPlan,
  BuiltExecutionPlan,
} from '../types/executor.types.ts';
import { buildExecutionPlan } from './execution-plan-builder.ts';
import { validateTask }       from '../validation/execution-validator.ts';
import { executorLogger }     from '../telemetry/executor-logger.ts';
import { toErrorMessage }     from '../utils/execution-utils.ts';

export class PlannerError extends Error {
  constructor(message: string) {
    super(`[execution-planner] ${message}`);
    this.name = 'PlannerError';
  }
}

export interface PlannerResult {
  ok:     boolean;
  plan?:  BuiltExecutionPlan;
  error?: string;
}

/**
 * Validate and build an execution plan from a raw ExecutionPlan.
 * Returns a PlannerResult — never throws.
 */
export function planExecution(
  plan:        ExecutionPlan,
  runId:       string,
  sandboxRoot: string,
): PlannerResult {
  // Validate all tasks
  for (const task of plan.tasks) {
    const r = validateTask(task);
    if (!r.ok) {
      const reason = r.reason ?? `task ${task.taskId} failed validation`;
      executorLogger.error(runId, `Plan validation failed: ${reason}`);
      return { ok: false, error: reason };
    }
  }

  // Validate dependency references
  const taskIds = new Set(plan.tasks.map((t) => t.taskId));
  for (const task of plan.tasks) {
    for (const dep of task.dependsOn ?? []) {
      if (!taskIds.has(dep)) {
        const reason = `task ${task.taskId} depends on unknown task "${dep}"`;
        executorLogger.error(runId, `Dependency error: ${reason}`);
        return { ok: false, error: reason };
      }
    }
  }

  try {
    const built = buildExecutionPlan(plan, runId, sandboxRoot);
    executorLogger.planBuilt(runId, built.planId, built.totalSteps);
    return { ok: true, plan: built };
  } catch (err) {
    const error = toErrorMessage(err);
    executorLogger.error(runId, `Plan build failed: ${error}`);
    return { ok: false, error };
  }
}
