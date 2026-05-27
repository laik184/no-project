import type { PlanTask } from '../types/planner.types.ts';
import type { DependencyGraph } from '../types/planning.types.ts';
import { topologicalSort } from '../utils/graph-utils.ts';
import { priorityWeight } from '../../../orchestration/utils/orchestration-helpers.ts';

export function buildExecutionOrder(
  tasks: PlanTask[],
  graph: DependencyGraph,
): string[] {
  const topOrder = topologicalSort(graph.nodes, graph.edges);

  if (topOrder === null) {
    return fallbackOrder(tasks);
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return topOrder.sort((a, b) => {
    const taskA = taskMap.get(a);
    const taskB = taskMap.get(b);
    if (!taskA || !taskB) return 0;

    const topoA = topOrder.indexOf(a);
    const topoB = topOrder.indexOf(b);
    if (topoA !== topoB) return topoA - topoB;

    const prioA = priorityWeight(taskA.priority);
    const prioB = priorityWeight(taskB.priority);
    return prioB - prioA;
  });
}

function fallbackOrder(tasks: PlanTask[]): string[] {
  return [...tasks]
    .sort((a, b) => {
      const phaseOrder = ['setup', 'backend', 'frontend', 'verification', 'deployment'];
      const phaseA = phaseOrder.indexOf(a.phase);
      const phaseB = phaseOrder.indexOf(b.phase);
      if (phaseA !== phaseB) return phaseA - phaseB;
      return priorityWeight(b.priority) - priorityWeight(a.priority);
    })
    .map((t) => t.id);
}
