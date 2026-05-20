import { TaskInput, DependencyWeight } from "../types";
import { clamp } from "../utils/normalize.util";

export function computeDependencyWeight(
  task: TaskInput,
  allTasks: readonly TaskInput[]
): DependencyWeight {
  const taskIds = new Set(allTasks.map((t) => t.id));

  const isBlocked = (task.dependencies ?? []).some((dep) => taskIds.has(dep));
  const blockingCount = countTasksBlocking(task.id, allTasks);

  let weight: number;
  let reason: string;

  if (blockingCount > 0 && !isBlocked) {
    const boost = clamp(50 + blockingCount * 10);
    weight = boost;
    reason = `Unblocked and blocking ${blockingCount} other task(s) — high priority for unblocking.`;
  } else if (isBlocked && blockingCount > 0) {
    weight = clamp(30 + blockingCount * 5);
    reason = `Blocked by dependencies but also blocking ${blockingCount} task(s) — resolve dependencies.`;
  } else if (isBlocked) {
    weight = 15;
    reason = `Blocked by ${task.dependencies?.length ?? 0} dependency/dependencies — deprioritized until resolved.`;
  } else if (blockingCount > 0) {
    weight = clamp(40 + blockingCount * 8);
    reason = `No dependencies; blocking ${blockingCount} downstream task(s).`;
  } else {
    weight = 25;
    reason = "No dependencies and not blocking any task — standard weight.";
  }

  return Object.freeze({ taskId: task.id, weight, blockingCount, isBlocked, reason });
}

function countTasksBlocking(taskId: string, allTasks: readonly TaskInput[]): number {
  return allTasks.filter(
    (t) => t.id !== taskId && (t.dependencies ?? []).includes(taskId)
  ).length;
}

export function computeAllDependencyWeights(
  tasks: readonly TaskInput[]
): readonly DependencyWeight[] {
  return Object.freeze(tasks.map((t) => computeDependencyWeight(t, tasks)));
}
