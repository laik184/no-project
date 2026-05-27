import type { PlanTask, TaskPriority, PhaseType } from '../types/planner.types.ts';

const PHASE_PRIORITY_MAP: Record<PhaseType, TaskPriority> = {
  setup:        'critical',
  backend:      'high',
  frontend:     'normal',
  verification: 'high',
  deployment:   'normal',
};

const CATEGORY_BOOST: Record<string, number> = {
  schema: 1,
  auth:   1,
  setup:  2,
  api:    0,
  ui:     0,
  test:   0,
  deploy: 0,
};

export function prioritizeTasks(tasks: PlanTask[]): PlanTask[] {
  return tasks.map((task) => ({
    ...task,
    priority: computePriority(task),
  }));
}

function computePriority(task: PlanTask): TaskPriority {
  const basePriority = PHASE_PRIORITY_MAP[task.phase] ?? 'normal';
  const boost        = CATEGORY_BOOST[task.category] ?? 0;

  if (boost >= 2 || basePriority === 'critical') return 'critical';
  if (boost >= 1 && basePriority === 'high')     return 'critical';
  if (boost >= 1)                                return 'high';
  return basePriority;
}

export function sortByPriority(tasks: PlanTask[]): PlanTask[] {
  const ORDER: Record<TaskPriority, number> = {
    critical: 0,
    high:     1,
    normal:   2,
    low:      3,
  };
  return [...tasks].sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}

export function filterByPriority(tasks: PlanTask[], min: TaskPriority): PlanTask[] {
  const ORDER: Record<TaskPriority, number> = {
    critical: 0,
    high:     1,
    normal:   2,
    low:      3,
  };
  return tasks.filter((t) => ORDER[t.priority] <= ORDER[min]);
}
