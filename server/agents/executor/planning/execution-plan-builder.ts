/**
 * server/agents/executor/planning/execution-plan-builder.ts
 *
 * Converts an ExecutionPlan into an ordered list of ExecutionSteps.
 * Handles dependency resolution and step ordering.
 * No execution logic — pure graph/sequence building.
 */

import type {
  ExecutionPlan,
  ExecutionTask,
  ExecutionStep,
  BuiltExecutionPlan,
} from '../types/executor.types.ts';
import { coordinateTask }  from '../coordination/tool-coordinator.ts';
import { generateStepId }  from '../utils/execution-utils.ts';

// ── Dependency resolver ───────────────────────────────────────────────────────

function topoSort(tasks: ExecutionTask[]): ExecutionTask[] {
  const byId = new Map(tasks.map((t) => [t.taskId, t]));
  const visited  = new Set<string>();
  const sorted:   ExecutionTask[] = [];

  function visit(taskId: string): void {
    if (visited.has(taskId)) return;
    visited.add(taskId);
    const task = byId.get(taskId);
    if (!task) return;
    for (const dep of task.dependsOn ?? []) {
      visit(dep);
    }
    sorted.push(task);
  }

  for (const task of tasks) visit(task.taskId);
  return sorted;
}

// ── Plan builder ──────────────────────────────────────────────────────────────

export function buildExecutionPlan(
  plan:        ExecutionPlan,
  runId:       string,
  sandboxRoot: string,
): BuiltExecutionPlan {
  const ordered = topoSort(plan.tasks);

  const steps: ExecutionStep[] = ordered.map((task) => {
    const routed = coordinateTask(task, sandboxRoot);
    return {
      stepId:    generateStepId(),
      taskId:    task.taskId,
      toolName:  routed.toolName,
      toolInput: routed.toolInput,
    };
  });

  return {
    planId:     plan.planId,
    runId,
    steps,
    totalSteps: steps.length,
  };
}

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getStepsForTask(
  plan:   BuiltExecutionPlan,
  taskId: string,
): ExecutionStep[] {
  return plan.steps.filter((s) => s.taskId === taskId);
}
