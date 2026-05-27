export interface TaskNode {
  id: string;
  type: string;
  description: string;
  dependsOn: string[];
  priority: 'critical' | 'high' | 'normal' | 'low';
}

export interface TaskGraph {
  goalSummary: string;
  tasks: TaskNode[];
  estimatedDurationMs: number;
  createdAt: Date;
}

const TASK_TEMPLATES: Array<{ type: string; description: string; priority: TaskNode['priority'] }> = [
  { type: 'analyze',      description: 'Analyze goal and determine scope',        priority: 'high'   },
  { type: 'plan',         description: 'Create implementation plan',               priority: 'high'   },
  { type: 'implement',    description: 'Implement core functionality',             priority: 'normal' },
  { type: 'verify',       description: 'Verify implementation correctness',        priority: 'high'   },
];

export function buildTaskGraph(goal: string): TaskGraph {
  const words = goal.toLowerCase().split(/\s+/);

  const tasks: TaskNode[] = TASK_TEMPLATES.map((tpl, i) => ({
    id:          `task_${i + 1}`,
    type:        tpl.type,
    description: `${tpl.description}: ${goal.slice(0, 60)}${goal.length > 60 ? '…' : ''}`,
    dependsOn:   i > 0 ? [`task_${i}`] : [],
    priority:    tpl.priority,
  }));

  const hasAuth     = /\b(auth|login|signup)\b/i.test(goal);
  const hasDatabase = /\b(database|db|postgres|mysql)\b/i.test(goal);

  if (hasAuth) {
    tasks.push({
      id: `task_auth`,
      type: 'auth_setup',
      description: 'Set up authentication system',
      dependsOn: ['task_2'],
      priority: 'high',
    });
  }

  if (hasDatabase) {
    tasks.push({
      id: `task_db`,
      type: 'db_setup',
      description: 'Configure database schema and migrations',
      dependsOn: ['task_2'],
      priority: 'high',
    });
  }

  return {
    goalSummary:         goal.slice(0, 200),
    tasks,
    estimatedDurationMs: tasks.length * 15_000,
    createdAt:           new Date(),
  };
}
