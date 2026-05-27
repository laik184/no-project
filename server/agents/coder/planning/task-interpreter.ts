import type { PlanTask } from '../../executor/types/executor.types.ts';

export interface PlannedStep {
  id:       string;
  type:     string;
  label:    string;
  filePath?: string;
  content?: string;
  command?: string;
}

const STEP_MAP: Record<string, PlannedStep[]> = {
  setup:    [{ id: 'setup-1', type: 'command', label: 'Install dependencies' }],
  schema:   [{ id: 'schema-1', type: 'write', label: 'Write database schema', filePath: 'shared/schema.ts' }],
  api:      [{ id: 'api-1', type: 'write', label: 'Write API routes', filePath: 'server/routes.ts' }],
  auth:     [{ id: 'auth-1', type: 'write', label: 'Write auth middleware', filePath: 'server/auth.ts' }],
  ui:       [{ id: 'ui-1', type: 'write', label: 'Write UI component', filePath: 'client/src/App.tsx' }],
  test:     [{ id: 'test-1', type: 'command', label: 'Run tests' }],
  deploy:   [{ id: 'deploy-1', type: 'command', label: 'Build project' }],
};

export function interpretTask(task: PlanTask): PlannedStep[] {
  const base = STEP_MAP[task.category ?? ''] ?? [
    { id: `${task.id}-default`, type: 'command', label: task.description ?? task.id },
  ];
  return base.map((step, i) => ({
    ...step,
    id: `${task.id}-step-${i + 1}`,
  }));
}
