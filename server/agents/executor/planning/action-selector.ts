import type { PlanTask } from '../types/executor.types.ts';
import type { ExecutionStep } from '../types/execution.types.ts';
import { determineStrategy } from './execution-strategy.ts';

export type ActionType =
  | 'generate_code'
  | 'write_files'
  | 'run_npm'
  | 'run_shell'
  | 'validate';

export interface PlannedAction {
  type:     ActionType;
  task:     PlanTask;
  strategy: ReturnType<typeof determineStrategy>;
}

export function selectAction(task: PlanTask): PlannedAction {
  const strategy = determineStrategy(task);

  let type: ActionType;

  if (strategy.requiresNpm && !strategy.requiresShell) {
    type = 'run_npm';
  } else if (strategy.requiresShell) {
    type = 'run_shell';
  } else if (strategy.fileStrategy === 'edit') {
    type = 'write_files';
  } else {
    type = 'generate_code';
  }

  return { type, task, strategy };
}

export function actionsForTasks(tasks: PlanTask[]): PlannedAction[] {
  return tasks.map(selectAction);
}

export function filterByActionType(
  actions: PlannedAction[],
  type: ActionType,
): PlannedAction[] {
  return actions.filter((a) => a.type === type);
}
