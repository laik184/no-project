/**
 * server/agents/planner/coordination/agent-coordinator.ts
 *
 * Coordinates downstream agents and routes planning execution tasks.
 * Builds the set of CoordinatorTasks that represent the plan dispatch sequence.
 * Pure orchestration — no direct tool execution.
 */

import type { ExecutionPlan, CoordinatorTask } from '../types/planner.types.ts';
import type { PlanningContext }                from '../core/planner-context.ts';
import { routePlanningTask }                   from './planning-routing.ts';
import { plannerLogger }                       from '../telemetry/planner-logger.ts';
import { makeTaskId }                          from '../utils/planning-utils.ts';

// ── Build dispatch tasks from execution plan ──────────────────────────────────

export function buildCoordinatorTasks(plan: ExecutionPlan): CoordinatorTask[] {
  const tasks: CoordinatorTask[] = [];

  // One coordinator task per execution plan phase
  for (const phase of plan.phases) {
    tasks.push({
      id:        makeTaskId(`coord-phase-${phase.index}`),
      label:     phase.label,
      toolName:  'create_execution_plan',
      input: {
        planId:    plan.planId,
        runId:     plan.runId,
        projectId: plan.projectId,
        phaseIndex: phase.index,
        strategy:  phase.strategy,
        taskCount: phase.tasks.length,
        taskIds:   phase.tasks.map((t) => t.id),
        goal:      plan.goal,
      },
      timeoutMs: 30_000,
      priority:  'high',
    });
  }

  // Final plan-seal task that hands the complete plan to the dispatcher
  tasks.push({
    id:        makeTaskId('coord-seal'),
    label:     'Seal and dispatch execution plan',
    toolName:  'create_execution_plan',
    input: {
      planId:     plan.planId,
      runId:      plan.runId,
      projectId:  plan.projectId,
      goal:       plan.goal,
      totalTasks: plan.totalTasks,
      phaseCount: plan.phases.length,
      estimatedMs: plan.estimatedMs,
      sealed:     true,
    },
    timeoutMs: 15_000,
    priority:  'critical',
  });

  return tasks;
}

// ── Run coordinator tasks in order ───────────────────────────────────────────

export async function runCoordinatorTasks(
  tasks:   CoordinatorTask[],
  context: PlanningContext,
): Promise<void> {
  const { runId } = context;
  plannerLogger.info(runId, `Coordinator: dispatching ${tasks.length} task(s)`);

  for (const task of tasks) {
    const outcome = await routePlanningTask(task, context, 1);
    if (!outcome.success) {
      plannerLogger.warn(runId, `Coordinator task failed — label="${task.label}"`, {
        error: outcome.error,
      });
      // Non-fatal: coordinator failures are logged but don't abort plan delivery
    } else {
      plannerLogger.task(runId, task.id, 'coordinator-ok', {
        durationMs: outcome.durationMs,
      });
    }
  }

  plannerLogger.info(runId, 'Coordinator: all tasks dispatched');
}
