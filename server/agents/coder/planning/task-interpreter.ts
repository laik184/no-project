import type { PlanTask } from '../../planner/types/planner.types.ts';
import type { ExecutionStep, StepType } from '../../executor/types/execution.types.ts';
import { randomUUID } from 'node:crypto';

function makeStep(
  taskId: string,
  type:   StepType,
  label:  string,
  input:  Record<string, unknown> = {},
  timeoutMs = 30_000,
): ExecutionStep {
  return { id: `step_${randomUUID().slice(0, 8)}`, taskId, type, label, input, timeoutMs };
}

const CATEGORY_STEP_MAP: Record<string, (task: PlanTask) => ExecutionStep[]> = {
  ui:        (t) => [makeStep(t.id, 'generate_frontend',  `Generate UI: ${t.title}`,   { name: t.title, category: 'page' }, 30_000)],
  frontend:  (t) => [makeStep(t.id, 'generate_frontend',  `Generate frontend: ${t.title}`, { name: t.title, category: 'page' }, 30_000)],
  api:       (t) => [makeStep(t.id, 'generate_api',       `Generate API: ${t.title}`,  { name: t.title }, 30_000)],
  backend:   (t) => [makeStep(t.id, 'generate_backend',   `Generate backend: ${t.title}`, { name: t.title }, 30_000)],
  schema:    (t) => [makeStep(t.id, 'generate_database',  `Generate schema: ${t.title}`, { name: t.title }, 30_000)],
  auth:      (t) => [makeStep(t.id, 'generate_auth',      `Generate auth: ${t.title}`, {}, 45_000)],
  test:      (t) => [makeStep(t.id, 'run_tests',          `Run tests: ${t.title}`,     { command: 'test' }, 60_000)],
  deploy:    (t) => [makeStep(t.id, 'npm_run',            `Build: ${t.title}`,         { command: 'build' }, 90_000)],
  setup:     (t) => [
    makeStep(t.id, 'npm_install',    `Install deps: ${t.title}`,   {}, 120_000),
    makeStep(t.id, 'list_directory', `Verify workspace: ${t.title}`, { filePath: '.' }, 10_000),
  ],
};

export function interpretTask(task: PlanTask): ExecutionStep[] {
  const category  = task.category?.toLowerCase() ?? 'unknown';
  const generator = CATEGORY_STEP_MAP[category];

  if (generator) return generator(task);

  return [
    makeStep(task.id, 'write_file', `Write file: ${task.title}`, {
      filePath:    `tasks/${task.id}.md`,
      fileContent: `# ${task.title}\n\n${task.description ?? ''}\n`,
    }),
  ];
}
