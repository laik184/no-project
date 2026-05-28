/**
 * server/agents/coderx/reasoning/dependency-analyzer.ts
 *
 * Analyzes dependency relationships between coding tasks.
 * Determines execution order and detects circular dependencies.
 * Pure reasoning logic — no execution.
 */

import type { CodingTask } from '../types/coderx.types.ts';

export interface DependencyGraph {
  readonly order:   string[];
  readonly cycles:  string[][];
  readonly hasCycle: boolean;
}

// ── Graph builder ─────────────────────────────────────────────────────────────

export function buildDependencyGraph(tasks: CodingTask[]): DependencyGraph {
  const taskIds = new Set(tasks.map((t) => t.taskId));
  const adj     = buildAdjacency(tasks, taskIds);
  const cycles  = detectCycles(adj, [...taskIds]);
  const order   = cycles.length === 0 ? topologicalSort(adj, [...taskIds]) : [];

  return { order, cycles, hasCycle: cycles.length > 0 };
}

// ── Adjacency map ─────────────────────────────────────────────────────────────

function buildAdjacency(
  tasks:   CodingTask[],
  taskIds: Set<string>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const task of tasks) {
    const deps = (task.dependsOn ?? []).filter((d) => taskIds.has(d));
    adj.set(task.taskId, deps);
  }
  return adj;
}

// ── Topological sort (Kahn's algorithm) ──────────────────────────────────────

function topologicalSort(
  adj:     Map<string, string[]>,
  taskIds: string[],
): string[] {
  const inDegree = new Map<string, number>();
  for (const id of taskIds) inDegree.set(id, 0);

  for (const deps of adj.values()) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const queue  = taskIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const result: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const dep of adj.get(node) ?? []) {
      const deg = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, deg);
      if (deg === 0) queue.push(dep);
    }
  }

  return result;
}

// ── Cycle detection (DFS) ─────────────────────────────────────────────────────

function detectCycles(
  adj:     Map<string, string[]>,
  taskIds: string[],
): string[][] {
  const visited  = new Set<string>();
  const recStack = new Set<string>();
  const cycles:  string[][] = [];

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recStack.add(node);

    for (const dep of adj.get(node) ?? []) {
      if (!visited.has(dep)) {
        dfs(dep, [...path, dep]);
      } else if (recStack.has(dep)) {
        const start = path.indexOf(dep);
        cycles.push(start >= 0 ? path.slice(start) : [...path, dep]);
      }
    }

    recStack.delete(node);
  }

  for (const id of taskIds) {
    if (!visited.has(id)) dfs(id, [id]);
  }

  return cycles;
}

// ── Readiness check ───────────────────────────────────────────────────────────

export function getReadyTasks(
  tasks:     CodingTask[],
  completed: Set<string>,
): CodingTask[] {
  return tasks.filter((task) => {
    const deps = task.dependsOn ?? [];
    return !completed.has(task.taskId) && deps.every((d) => completed.has(d));
  });
}
