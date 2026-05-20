import type { PlanTask, ExecutionLevel } from "../types.js";

const PARALLEL_MIN_SIZE = 2;

type AdjacencyMap = Readonly<Record<string, readonly string[]>>;

function computeInDegrees(
  nodes: readonly PlanTask[],
  adj:   AdjacencyMap,
): Map<string, number> {
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }
  for (const deps of Object.values(adj)) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }
  return inDegree;
}

function buildReverseDeps(
  nodes: readonly PlanTask[],
  adj:   AdjacencyMap,
): Map<string, string[]> {
  const rev = new Map<string, string[]>();
  for (const node of nodes) {
    rev.set(node.id, []);
  }
  for (const [nodeId, deps] of Object.entries(adj)) {
    for (const dep of deps) {
      const existing = rev.get(dep) ?? [];
      existing.push(nodeId);
      rev.set(dep, existing);
    }
  }
  return rev;
}

export function resolveExecutionOrder(
  nodes: readonly PlanTask[],
  adj:   AdjacencyMap,
): readonly ExecutionLevel[] {
  if (nodes.length === 0) return Object.freeze([]);

  const inDegree  = computeInDegrees(nodes, adj);
  const reverseDeps = buildReverseDeps(nodes, adj);
  const resolved  = new Set<string>();
  const levels: ExecutionLevel[] = [];
  let   levelIndex = 0;

  while (resolved.size < nodes.length) {
    const currentLevel: string[] = [];

    for (const node of nodes) {
      if (resolved.has(node.id)) continue;

      const degree = inDegree.get(node.id) ?? 0;
      if (degree === 0) {
        currentLevel.push(node.id);
      }
    }

    if (currentLevel.length === 0) break;

    const sorted = [...currentLevel].sort((a, b) => {
      const taskA = nodes.find(n => n.id === a);
      const taskB = nodes.find(n => n.id === b);
      return (taskA?.priority ?? 0) - (taskB?.priority ?? 0);
    });

    levels.push(Object.freeze<ExecutionLevel>({
      level:          levelIndex,
      taskIds:        Object.freeze(sorted),
      canParallelize: sorted.length >= PARALLEL_MIN_SIZE,
    }));

    for (const nodeId of sorted) {
      resolved.add(nodeId);
      inDegree.set(nodeId, -1);

      const dependents = reverseDeps.get(nodeId) ?? [];
      for (const dependent of dependents) {
        const current = inDegree.get(dependent) ?? 0;
        if (current > 0) {
          inDegree.set(dependent, current - 1);
        }
      }
    }

    levelIndex += 1;
  }

  const unresolved = nodes.filter(n => !resolved.has(n.id));
  if (unresolved.length > 0) {
    levels.push(Object.freeze<ExecutionLevel>({
      level:          levelIndex,
      taskIds:        Object.freeze(unresolved.map(n => n.id)),
      canParallelize: unresolved.length >= PARALLEL_MIN_SIZE,
    }));
  }

  return Object.freeze(levels);
}

export function flattenLevels(levels: readonly ExecutionLevel[]): readonly string[] {
  const result: string[] = [];
  for (const level of levels) {
    result.push(...level.taskIds);
  }
  return Object.freeze(result);
}

export function computeTotalEffort(
  nodes:  readonly PlanTask[],
  levels: readonly ExecutionLevel[],
): number {
  let total = 0;
  for (const level of levels) {
    const levelTasks = level.taskIds
      .map(id => nodes.find(n => n.id === id))
      .filter((t): t is PlanTask => t !== undefined);
    const maxEffort = Math.max(...levelTasks.map(t => t.estimatedEffort), 0);
    total += maxEffort;
  }
  return total;
}
