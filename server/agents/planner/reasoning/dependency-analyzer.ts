/**
 * server/agents/planner/reasoning/dependency-analyzer.ts
 *
 * Analyzes a task list to detect dependencies, blockers, and cycles.
 * Produces a topologically sorted execution order and flags any cycles
 * that would prevent safe sequential or parallel execution.
 *
 * No tool imports. No execution. Pure graph analysis.
 */

import type { PlannedTask } from '../types/planner.types.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DependencyEdge {
  from:  string;   // task id
  to:    string;   // task id (from depends on to)
  kind:  'explicit' | 'inferred';
}

export interface DependencyAnalysis {
  edges:         DependencyEdge[];
  sortedOrder:   string[];        // topological order — safe execution sequence
  cycles:        string[][];      // each inner array is a cycle
  blockers:      string[];        // tasks with unresolvable dependencies
  parallelGroups: string[][];     // groups of tasks that can run in parallel
  hasCycles:     boolean;
}

// ── Topological sort (Kahn's algorithm) ──────────────────────────────────────

function _topoSort(
  taskIds: string[],
  deps:    Map<string, string[]>,   // id → list of prerequisite ids
): { order: string[]; cycles: string[][] } {
  const inDegree = new Map<string, number>();
  const adjList  = new Map<string, string[]>();

  for (const id of taskIds) {
    inDegree.set(id, 0);
    adjList.set(id, []);
  }

  for (const [id, prerequisites] of deps) {
    for (const prereq of prerequisites) {
      if (!taskIds.includes(prereq)) continue;
      adjList.get(prereq)!.push(id);
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const neighbor of (adjList.get(node) ?? [])) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  // Remaining nodes with in-degree > 0 are in cycles
  const cycleNodes = [...inDegree.entries()]
    .filter(([, d]) => d > 0)
    .map(([id]) => id);

  const cycles: string[][] = cycleNodes.length > 0 ? [cycleNodes] : [];
  return { order, cycles };
}

// ── Parallel groups from sorted order ────────────────────────────────────────

function _buildParallelGroups(
  order: string[],
  deps:  Map<string, string[]>,
): string[][] {
  const groups:  string[][] = [];
  const assigned = new Set<string>();

  while (assigned.size < order.length) {
    const wave: string[] = [];
    for (const id of order) {
      if (assigned.has(id)) continue;
      const prerequisites = deps.get(id) ?? [];
      const ready         = prerequisites.every((p) => assigned.has(p));
      if (ready) wave.push(id);
    }
    if (wave.length === 0) break;   // cycle guard
    for (const id of wave) assigned.add(id);
    groups.push(wave);
  }

  return groups;
}

// ── Infer implicit dependencies ───────────────────────────────────────────────

function _inferDependencies(tasks: PlannedTask[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const phaseMap = new Map<number, string[]>();

  for (const t of tasks) {
    const group = phaseMap.get(t.phase) ?? [];
    group.push(t.id);
    phaseMap.set(t.phase, group);
  }

  // Tasks in higher phases implicitly depend on all tasks in earlier phases
  const sortedPhases = [...phaseMap.keys()].sort((a, b) => a - b);
  for (let i = 1; i < sortedPhases.length; i++) {
    const curPhase  = sortedPhases[i];
    const prevPhase = sortedPhases[i - 1];
    for (const curId of (phaseMap.get(curPhase) ?? [])) {
      for (const prevId of (phaseMap.get(prevPhase) ?? [])) {
        edges.push({ from: curId, to: prevId, kind: 'inferred' });
      }
    }
  }
  return edges;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function analyzeDependencies(tasks: PlannedTask[]): DependencyAnalysis {
  const taskIds = tasks.map((t) => t.id);

  // Build explicit edges from task.dependencies
  const explicitEdges: DependencyEdge[] = [];
  const depMap = new Map<string, string[]>();

  for (const task of tasks) {
    const prereqs = task.dependencies ?? [];
    depMap.set(task.id, prereqs);
    for (const dep of prereqs) {
      explicitEdges.push({ from: task.id, to: dep, kind: 'explicit' });
    }
  }

  // Infer phase-based implicit dependencies
  const inferredEdges = _inferDependencies(tasks);

  // Merge into depMap
  for (const edge of inferredEdges) {
    if (!explicitEdges.find((e) => e.from === edge.from && e.to === edge.to)) {
      const list = depMap.get(edge.from) ?? [];
      if (!list.includes(edge.to)) list.push(edge.to);
      depMap.set(edge.from, list);
    }
  }

  const { order, cycles } = _topoSort(taskIds, depMap);
  const parallelGroups    = _buildParallelGroups(order, depMap);

  // Blockers = tasks whose dependencies reference non-existent task IDs
  const blockers = tasks
    .filter((t) => (t.dependencies ?? []).some((d) => !taskIds.includes(d)))
    .map((t) => t.id);

  return {
    edges:          [...explicitEdges, ...inferredEdges],
    sortedOrder:    order,
    cycles,
    blockers,
    parallelGroups,
    hasCycles:      cycles.length > 0,
  };
}

/** Remove all cyclic tasks from a list — returns a safe subset. */
export function removeCyclicTasks(
  tasks:    PlannedTask[],
  analysis: DependencyAnalysis,
): PlannedTask[] {
  const cycleIds = new Set(analysis.cycles.flat());
  return tasks.filter((t) => !cycleIds.has(t.id));
}
