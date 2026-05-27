import type { PlanTask, PlanPhase } from '../types/planner.types.ts';
import type { DependencyGraph } from '../types/planning.types.ts';
import { buildDependencyGraph } from '../utils/graph-utils.ts';

export function buildTaskDependencyGraph(
  phases: PlanPhase[],
  tasks: PlanTask[],
): DependencyGraph {
  const edges: Array<{ from: string; to: string }> = [];

  wireInterPhaseDependencies(phases, edges);
  wireIntraPhaseDependencies(phases, edges);
  applyEdgesToTasks(tasks, edges);

  return buildDependencyGraph(
    tasks.map((t) => t.id),
    edges,
  );
}

function wireInterPhaseDependencies(
  phases: PlanPhase[],
  edges: Array<{ from: string; to: string }>,
): void {
  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1];
    const curr = phases[i];
    const lastPrevTask  = prev.tasks[prev.tasks.length - 1];
    const firstCurrTask = curr.tasks[0];
    if (lastPrevTask && firstCurrTask) {
      edges.push({ from: lastPrevTask.id, to: firstCurrTask.id });
    }
  }
}

function wireIntraPhaseDependencies(
  phases: PlanPhase[],
  edges: Array<{ from: string; to: string }>,
): void {
  for (const phase of phases) {
    for (let i = 1; i < phase.tasks.length; i++) {
      edges.push({ from: phase.tasks[i - 1].id, to: phase.tasks[i].id });
    }
  }
}

function applyEdgesToTasks(
  tasks: PlanTask[],
  edges: Array<{ from: string; to: string }>,
): void {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  for (const { from, to } of edges) {
    const target = taskMap.get(to);
    if (target && !target.dependencies.includes(from)) {
      target.dependencies.push(from);
    }
  }
}
