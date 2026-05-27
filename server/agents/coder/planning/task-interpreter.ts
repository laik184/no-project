import type { PlanTask } from '../../planner/types/planner.types.ts';
import type { ExecutionStep } from '../../executor/types/execution.types.ts';
import { v4 as uuid } from 'uuid';

export function interpretTask(task: PlanTask): ExecutionStep[] {
  const base = { taskId: task.id, timeoutMs: 30_000, input: {} };

  switch (task.category) {
    case 'setup':
      return [{ ...base, id: uuid(), type: 'npm_install', label: 'Install dependencies', input: { args: [] } }];
    case 'schema':
      return [{ ...base, id: uuid(), type: 'generate_database', label: `Generate schema: ${task.title}`, input: { name: task.title } }];
    case 'api':
      return [{ ...base, id: uuid(), type: 'generate_api', label: `Generate API: ${task.title}`, input: { name: task.title } }];
    case 'auth':
      return [{ ...base, id: uuid(), type: 'generate_auth', label: 'Generate auth system', input: {} }];
    case 'ui':
      return [{ ...base, id: uuid(), type: 'generate_frontend', label: `Generate UI: ${task.title}`, input: { name: task.title } }];
    case 'test':
      return [{ ...base, id: uuid(), type: 'run_tests', label: 'Run tests', input: { command: 'test' } }];
    case 'deploy':
      return [{ ...base, id: uuid(), type: 'npm_run', label: 'Build for deploy', input: { command: 'build' } }];
    default:
      return [{ ...base, id: uuid(), type: 'validate_output', label: `Task: ${task.title}`, input: { description: task.description } }];
  }
}
