/**
 * task-interpreter.ts
 * Translates a PlanTask into a sequence of ExecutionSteps.
 * Single responsibility: task-to-step mapping only.
 */

import type { PlanTask }     from '../../../agents/planner/types/planner.types.ts';
import type { ExecutionStep } from '../../executor/types/execution.types.ts';

const DEFAULT_TIMEOUT_MS = 30_000;

function stepId(taskId: string, idx: number): string {
  return `${taskId}_s${idx}`;
}

const CATEGORY_STEP_MAP: Record<string, (task: PlanTask, idx: number) => ExecutionStep> = {
  schema: (task, idx) => ({
    id:        stepId(task.id, idx),
    taskId:    task.id,
    type:      'generate_database',
    label:     `Generate DB schema: ${task.title}`,
    input:     { name: task.title, description: task.description },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }),

  api: (task, idx) => ({
    id:        stepId(task.id, idx),
    taskId:    task.id,
    type:      'generate_api',
    label:     `Generate API: ${task.title}`,
    input:     { name: task.title, description: task.description },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }),

  auth: (task, idx) => ({
    id:        stepId(task.id, idx),
    taskId:    task.id,
    type:      'generate_auth',
    label:     `Generate auth: ${task.title}`,
    input:     { name: task.title },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }),

  ui: (task, idx) => ({
    id:        stepId(task.id, idx),
    taskId:    task.id,
    type:      'generate_frontend',
    label:     `Generate UI: ${task.title}`,
    input:     { name: task.title, category: 'page', description: task.description },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }),

  setup: (task, idx) => ({
    id:        stepId(task.id, idx),
    taskId:    task.id,
    type:      'run_command',
    label:     `Setup: ${task.title}`,
    input:     { command: 'echo "setup step"', description: task.description },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }),

  test: (task, idx) => ({
    id:        stepId(task.id, idx),
    taskId:    task.id,
    type:      'run_tests',
    label:     `Run tests: ${task.title}`,
    input:     { command: 'test', description: task.description },
    timeoutMs: 60_000,
  }),

  deploy: (task, idx) => ({
    id:        stepId(task.id, idx),
    taskId:    task.id,
    type:      'run_command',
    label:     `Deploy: ${task.title}`,
    input:     { command: 'echo "deploy step"', description: task.description },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }),
};

export function interpretTask(task: PlanTask): ExecutionStep[] {
  const builder = CATEGORY_STEP_MAP[task.category];
  if (builder) return [builder(task, 0)];

  // Fallback: validate_output no-op step
  return [{
    id:        stepId(task.id, 0),
    taskId:    task.id,
    type:      'validate_output',
    label:     `Validate: ${task.title}`,
    input:     { description: task.description },
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }];
}
