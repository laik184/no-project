import type { PlanTask } from '../types/planner.types.ts';
import { plannerMetrics } from '../telemetry/planner-metrics.ts';

export interface DependencyValidationResult {
  valid:   boolean;
  errors:  string[];
  missing: string[];
}

export function validateDependencies(
  runId: string,
  tasks: PlanTask[],
): DependencyValidationResult {
  const taskIds = new Set(tasks.map((t) => t.id));
  const errors:  string[] = [];
  const missing: string[] = [];

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) {
        const msg = `Task '${task.id}' references unknown dependency '${dep}'`;
        errors.push(msg);
        missing.push(dep);
        plannerMetrics.recordDependencyError(runId);
      }
    }
  }

  return {
    valid:   errors.length === 0,
    errors,
    missing: [...new Set(missing)],
  };
}

export function validatePhaseOrdering(tasks: PlanTask[]): string[] {
  const phaseOrder = ['setup', 'backend', 'frontend', 'verification', 'deployment'];
  const errors: string[] = [];
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const task of tasks) {
    const taskPhaseIdx = phaseOrder.indexOf(task.phase);
    for (const depId of task.dependencies) {
      const dep = taskMap.get(depId);
      if (!dep) continue;
      const depPhaseIdx = phaseOrder.indexOf(dep.phase);
      if (depPhaseIdx > taskPhaseIdx) {
        errors.push(
          `Task '${task.id}' (phase: ${task.phase}) depends on '${depId}' ` +
          `(phase: ${dep.phase}) which runs later.`,
        );
      }
    }
  }

  return errors;
}
