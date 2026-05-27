import type { PlanTask } from '../types/executor.types.ts';

export type ExecutionMode = 'sequential' | 'parallel';
export type FileStrategy  = 'create' | 'edit';
export type CodeStrategy  = 'template' | 'generated';

export interface TaskStrategy {
  executionMode: ExecutionMode;
  fileStrategy:  FileStrategy;
  codeStrategy:  CodeStrategy;
  requiresNpm:   boolean;
  requiresShell: boolean;
}

const PARALLEL_SAFE_CATEGORIES = new Set(['ui', 'test']);
const EDIT_CATEGORIES          = new Set(['api', 'auth']);
const NPM_CATEGORIES           = new Set(['setup', 'deploy']);
const SHELL_CATEGORIES         = new Set(['setup', 'test', 'deploy']);

export function determineStrategy(task: PlanTask): TaskStrategy {
  const cat = task.category;

  return {
    executionMode: PARALLEL_SAFE_CATEGORIES.has(cat) ? 'parallel' : 'sequential',
    fileStrategy:  EDIT_CATEGORIES.has(cat) ? 'edit' : 'create',
    codeStrategy:  'template',
    requiresNpm:   NPM_CATEGORIES.has(cat),
    requiresShell: SHELL_CATEGORIES.has(cat),
  };
}

export function canRunInParallel(tasks: PlanTask[]): boolean {
  return tasks.every((t) => PARALLEL_SAFE_CATEGORIES.has(t.category));
}

export function sortByPriority(tasks: PlanTask[]): PlanTask[] {
  const order: Record<string, number> = {
    critical: 4, high: 3, normal: 2, low: 1,
  };
  return [...tasks].sort((a, b) => (order[b.priority] ?? 2) - (order[a.priority] ?? 2));
}
