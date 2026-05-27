export interface TaskGraph {
  tasks: { id: string; description: string }[];
}

export function buildTaskGraph(goal: string): TaskGraph {
  return {
    tasks: [{ id: 'task-1', description: goal }],
  };
}
