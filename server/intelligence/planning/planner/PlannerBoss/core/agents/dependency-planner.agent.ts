import type { AtomicTask, TaskDependency, TaskDependencyMap } from "../../types.ts";

const MAX_CYCLE_ITERATIONS = 10_000;

function buildAdjacency(
  tasks:       readonly AtomicTask[],
  dependencies: readonly TaskDependency[],
): Map<string, readonly string[]> {
  const adj: Map<string, readonly string[]> = new Map();
  for (const task of tasks) {
    adj.set(task.id, []);
  }
  for (const dep of dependencies) {
    adj.set(dep.taskId, dep.dependsOn);
  }
  return adj;
}

function detectCycle(adj: Map<string, readonly string[]>): boolean {
  const visited    = new Set<string>();
  const inProgress = new Set<string>();
  let   iterations = 0;

  function dfs(nodeId: string): boolean {
    if (iterations >= MAX_CYCLE_ITERATIONS) return false;
    iterations += 1;

    if (inProgress.has(nodeId)) return true;
    if (visited.has(nodeId))    return false;

    inProgress.add(nodeId);
    const neighbors = adj.get(nodeId) ?? [];

    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    inProgress.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  for (const nodeId of adj.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) return true;
    }
  }
  return false;
}

function topologicalLevels(
  tasks:       readonly AtomicTask[],
  dependencies: readonly TaskDependency[],
): readonly (readonly string[])[] {
  const depMap = new Map<string, Set<string>>();
  for (const task of tasks) {
    depMap.set(task.id, new Set());
  }
  for (const dep of dependencies) {
    depMap.set(dep.taskId, new Set(dep.dependsOn));
  }

  const levels: (string[])[] = [];
  const resolved = new Set<string>();

  while (resolved.size < tasks.length) {
    const currentLevel: string[] = [];

    for (const task of tasks) {
      if (resolved.has(task.id)) continue;
      const deps  = depMap.get(task.id) ?? new Set();
      const ready = [...deps].every(d => resolved.has(d));
      if (ready) currentLevel.push(task.id);
    }

    if (currentLevel.length === 0) break;

    for (const id of currentLevel) resolved.add(id);
    levels.push(currentLevel);
  }

  return Object.freeze(levels.map(level => Object.freeze(level)));
}

function inferDependencies(tasks: readonly AtomicTask[]): readonly TaskDependency[] {
  const outputIndex = new Map<string, string>();

  for (const task of tasks) {
    for (const output of task.outputs) {
      outputIndex.set(output, task.id);
    }
  }

  const dependencies: TaskDependency[] = [];

  for (const task of tasks) {
    const dependsOn: string[] = [];

    for (const input of task.inputs) {
      const producerId = outputIndex.get(input);
      if (producerId !== undefined && producerId !== task.id) {
        if (!dependsOn.includes(producerId)) {
          dependsOn.push(producerId);
        }
      }
    }

    if (dependsOn.length > 0) {
      dependencies.push(Object.freeze<TaskDependency>({
        taskId:    task.id,
        dependsOn: Object.freeze(dependsOn),
      }));
    }
  }

  return Object.freeze(dependencies);
}

export function planDependencies(tasks: readonly AtomicTask[]): TaskDependencyMap {
  const dependencies    = inferDependencies(tasks);
  const adj             = buildAdjacency(tasks, dependencies);
  const hasCircularDeps = detectCycle(adj);
  const executionLevels = hasCircularDeps
    ? Object.freeze([Object.freeze(tasks.map(t => t.id))])
    : topologicalLevels(tasks, dependencies);

  return Object.freeze<TaskDependencyMap>({
    tasks:           Object.freeze([...tasks]),
    dependencies,
    executionLevels,
    hasCircularDeps,
  });
}
