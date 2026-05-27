import type { ExecutionPlan } from '../types/planner.types.ts';
import type { ValidationResult } from '../types/planning.types.ts';
import { validateDependencies, validatePhaseOrdering } from './dependency-validator.ts';
import { checkForCircularDependencies } from './circular-check.ts';

export function validatePlan(runId: string, plan: Partial<ExecutionPlan>): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!plan.planId)    errors.push('Plan is missing planId');
  if (!plan.runId)     errors.push('Plan is missing runId');
  if (!plan.appType)   errors.push('Plan is missing appType');
  if (!plan.complexity)errors.push('Plan is missing complexity');

  if (!plan.tasks || plan.tasks.length === 0) {
    errors.push('Plan contains no tasks');
  }

  if (!plan.phases || plan.phases.length === 0) {
    errors.push('Plan contains no phases');
  }

  if (plan.tasks && plan.tasks.length > 0) {
    const depResult = validateDependencies(runId, plan.tasks);
    errors.push(...depResult.errors);

    const orderErrors = validatePhaseOrdering(plan.tasks);
    errors.push(...orderErrors);
  }

  if (plan.dependencyGraph) {
    const circularResult = checkForCircularDependencies(plan.dependencyGraph);
    if (circularResult.hasCycles) {
      errors.push(circularResult.description);
    }
  }

  if (plan.executionOrder && plan.tasks) {
    const orphaned = plan.tasks.filter(
      (t) => !plan.executionOrder!.includes(t.id),
    );
    if (orphaned.length > 0) {
      warnings.push(
        `${orphaned.length} task(s) not present in executionOrder: ` +
        orphaned.map((t) => t.id).join(', '),
      );
    }
  }

  if (!plan.frontendPlan?.framework && !plan.backendPlan?.framework) {
    warnings.push('Neither frontend nor backend plan defines a framework');
  }

  if (!plan.databasePlan?.type) {
    warnings.push('No database type specified');
  }

  return {
    valid:      errors.length === 0,
    errors,
    warnings,
    checkedAt:  new Date(),
  };
}
