/**
 * server/agents/planner/execution/planning-loop.ts
 *
 * THE HEART of the planner agent.
 *
 * Controls the full planning lifecycle:
 *   - goal → task list (task-planner)
 *   - tasks → dependency resolution (dependency-planner)
 *   - tasks → execution phases (phase-planner)
 *   - phases → execution plan (execution-plan-builder)
 *   - plan → coordinator dispatch (agent-coordinator)
 *
 * Architecture: orchestration ONLY.
 * No child_process. No spawn. No exec. No shell. No direct tool calls.
 */

import type { ExecutionPlan }          from '../types/planner.types.ts';
import type { PlanningContext }         from '../core/planner-context.ts';
import { plannerState }                 from '../core/planner-state.ts';
import { plannerSession }               from '../core/planner-session.ts';
import { plannerLogger }                from '../telemetry/planner-logger.ts';
import { plannerMetrics }               from '../telemetry/planner-metrics.ts';
import { planningMonitor }              from '../monitoring/planning-monitor.ts';
import { buildTaskList }                from '../planning/task-planner.ts';
import { resolveDependencies }          from '../planning/dependency-planner.ts';
import { buildExecutionPhases }         from '../planning/phase-planner.ts';
import { buildExecutionPlan }           from '../planning/execution-plan-builder.ts';
import { validateExecutionPlan }        from '../validation/planning-validator.ts';
import { analyzeGoal }                  from '../engine/index.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_REFINEMENTS = 2;

// ── Main planning loop ────────────────────────────────────────────────────────

export async function runPlanningLoop(
  context: PlanningContext,
): Promise<ExecutionPlan | null> {
  const { runId, projectId, goal } = context;

  plannerLogger.info(runId, 'Planning loop started', { goal: goal.slice(0, 80) });

  // ── 1. Goal analysis ──────────────────────────────────────────────────────
  plannerSession.transition(runId, 'analyzing');
  plannerLogger.phase(runId, 'analyzing');
  const analysis = analyzeGoal(goal);

  // ── 2. Task planning ──────────────────────────────────────────────────────
  plannerSession.transition(runId, 'task-planning');
  plannerLogger.phase(runId, 'task-planning');
  const tasks = await buildTaskList(goal, projectId);

  if (tasks.length === 0) {
    plannerLogger.error(runId, 'Task planner produced zero tasks');
    planningMonitor.recordInvalidPlan(runId);
    return null;
  }

  // ── 3. Dependency resolution ──────────────────────────────────────────────
  plannerSession.transition(runId, 'dependency-resolution');
  plannerLogger.phase(runId, 'dependency-resolution');
  const resolution = resolveDependencies(tasks, analysis.components);

  if (resolution.errors.length > 0) {
    plannerLogger.error(runId, 'Dependency resolution failed', {
      errors: resolution.errors,
    });
    planningMonitor.recordInvalidPlan(runId);
    return null;
  }

  if (resolution.warnings.length > 0) {
    plannerLogger.warn(runId, 'Dependency resolution warnings', {
      warnings: resolution.warnings,
    });
  }

  // ── 4. Phase planning ─────────────────────────────────────────────────────
  plannerSession.transition(runId, 'phase-planning');
  plannerLogger.phase(runId, 'phase-planning');
  const phases = buildExecutionPhases(resolution.orderedTasks, analysis.components);

  // ── 5. Plan building + refinement loop ───────────────────────────────────
  plannerSession.transition(runId, 'plan-building');
  plannerLogger.phase(runId, 'plan-building');

  let plan: ExecutionPlan | null = null;
  let refinementAttempt = 0;

  while (refinementAttempt <= MAX_REFINEMENTS) {
    const candidate = buildExecutionPlan({
      runId, projectId, goal,
      tasks:    resolution.orderedTasks,
      phases,
      meta:     context.meta as Record<string, unknown>,
      analysis,
    });

    const validation = validateExecutionPlan(candidate);

    if (validation.valid) {
      // Rebuild with validation results attached
      plan = buildExecutionPlan({
        runId, projectId, goal,
        tasks:      resolution.orderedTasks,
        phases,
        meta:       context.meta as Record<string, unknown>,
        analysis,
        validation: { valid: true, errors: [], warnings: validation.warnings },
      });
      plannerState.setPlan(runId, plan);
      plannerLogger.planReady(runId, plan.planId, plan.phases.length, plan.totalTasks);
      break;
    }

    refinementAttempt++;
    plannerMetrics.recordRefinement(runId);
    plannerState.incrementRefinements(runId);
    plannerLogger.refinement(runId, refinementAttempt, validation.errors.join('; '));

    if (refinementAttempt > MAX_REFINEMENTS) {
      plannerLogger.error(runId, 'Plan refinement limit exceeded', {
        errors: validation.errors,
      });
      planningMonitor.recordInvalidPlan(runId);
      return null;
    }
  }

  if (!plan) return null;

  // ── 6. Plan ready — coordinator dispatch removed ─────────────────────────
  // The plan is fully built and validated above. The orchestration layer's
  // enrichPhase() forwards this plan to the executor phase automatically.
  // Removing coordinator dispatch eliminates the 'create_execution_plan'
  // ToolNotFoundError that was crashing every planning run.
  plannerSession.transition(runId, 'routing');
  plannerLogger.phase(runId, 'routing');

  plannerLogger.info(runId, 'Planning loop complete', {
    planId:     plan.planId,
    phases:     plan.phases.length,
    totalTasks: plan.totalTasks,
    estimatedMs: plan.estimatedMs,
  });

  return plan;
}
