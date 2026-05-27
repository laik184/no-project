import type { PlanTask } from '../types/executor.types.ts';
import type { ExecutionStep, StepType, StepInput } from '../types/execution.types.ts';
import { generateStepId, stepTimeout, categoryToStepType, formatStepLabel } from '../utils/execution-helpers.ts';

export function interpretTask(task: PlanTask): ExecutionStep[] {
  const steps: ExecutionStep[] = [];

  const primaryType = categoryToStepType(task.category) as StepType;

  steps.push(buildStep(task.id, primaryType, task));

  if (task.category === 'setup') {
    steps.push(buildNpmInstallStep(task.id));
  }

  if (task.category === 'schema') {
    steps.push(buildValidateStep(task.id, 'schema'));
  }

  if (task.category === 'api' || task.category === 'auth') {
    steps.push(buildValidateStep(task.id, task.category));
  }

  steps.push(buildCheckpointStep(task.id));

  return steps;
}

function buildStep(
  taskId:   string,
  type:     StepType,
  task:     PlanTask,
): ExecutionStep {
  const input: StepInput = {
    description: task.description,
    category:    task.category,
    name:        task.title,
  };

  return {
    id:        generateStepId(type),
    taskId,
    type,
    label:     formatStepLabel(type, task.title),
    input,
    timeoutMs: stepTimeout(type),
  };
}

function buildNpmInstallStep(taskId: string): ExecutionStep {
  return {
    id:        generateStepId('npm_install'),
    taskId,
    type:      'npm_install',
    label:     'Install dependencies',
    input:     { args: [] },
    timeoutMs: stepTimeout('npm_install'),
  };
}

function buildValidateStep(taskId: string, context: string): ExecutionStep {
  return {
    id:        generateStepId('validate_output'),
    taskId,
    type:      'validate_output',
    label:     `Validate ${context} output`,
    input:     { description: context },
    timeoutMs: stepTimeout('validate_output'),
  };
}

function buildCheckpointStep(taskId: string): ExecutionStep {
  return {
    id:        generateStepId('checkpoint'),
    taskId,
    type:      'checkpoint',
    label:     'Save checkpoint',
    input:     {},
    timeoutMs: stepTimeout('checkpoint'),
  };
}
