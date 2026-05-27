import type { PlanPhase, PlanTask } from '../types/planner.types.ts';
import type { DependencyGraph } from '../types/planning.types.ts';
import { buildExecutionOrder } from './execution-order.ts';
import { prioritizeTasks, sortByPriority } from './task-prioritizer.ts';

export interface SequencedPipeline {
  phases:         PlanPhase[];
  tasks:          PlanTask[];
  executionOrder: string[];
}

export function sequencePipeline(
  phases: PlanPhase[],
  tasks: PlanTask[],
  graph: DependencyGraph,
): SequencedPipeline {
  const prioritizedTasks = prioritizeTasks(tasks);
  const sortedTasks      = sortByPriority(prioritizedTasks);
  const executionOrder   = buildExecutionOrder(sortedTasks, graph);

  const taskMap = new Map(sortedTasks.map((t) => [t.id, t]));

  const updatedPhases = phases.map((phase) => ({
    ...phase,
    tasks: phase.tasks
      .map((t) => taskMap.get(t.id) ?? t)
      .sort((a, b) => executionOrder.indexOf(a.id) - executionOrder.indexOf(b.id)),
  }));

  return {
    phases:         updatedPhases,
    tasks:          sortedTasks,
    executionOrder,
  };
}
