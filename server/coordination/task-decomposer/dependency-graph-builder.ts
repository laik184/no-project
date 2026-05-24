/**
 * dependency-graph-builder.ts
 *
 * Builds a topologically sorted DependencyGraph from a flat list of tasks.
 * Single responsibility: graph construction + topological sort + cycle detection.
 *
 * Algorithm: Kahn's algorithm (BFS topological sort).
 * Safety: detects cycles and throws a descriptive error before execution starts.
 */

import type { SpecialistTask } from "../contracts/specialist.contracts.ts";
import type { DependencyGraph, DependencyEdge } from "../contracts/coordination.contracts.ts";

// ── Cycle detection ───────────────────────────────────────────────────────────

function detectCycle(
  adjList: Map<string, string[]>,
  nodes:   string[],
): string[] | null {
  const visited = new Set<string>();
  const stack   = new Set<string>();

  function dfs(node: string): string[] | null {
    visited.add(node);
    stack.add(node);
    for (const dep of adjList.get(node) ?? []) {
      if (!visited.has(dep)) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      } else if (stack.has(dep)) {
        return [node, dep];
      }
    }
    stack.delete(node);
    return null;
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

// ── Kahn's topological sort → waves ──────────────────────────────────────────

function computeWaves(
  nodes:   string[],
  adjList: Map<string, string[]>,
): string[][] {
  // in-degree: how many dependencies each node has
  const inDegree = new Map<string, number>(nodes.map(n => [n, 0]));
  for (const [, deps] of adjList) {
    for (const dep of deps) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  const waves: string[][] = [];
  let ready = nodes.filter(n => (inDegree.get(n) ?? 0) === 0);

  while (ready.length > 0) {
    waves.push([...ready]);
    const nextReady: string[] = [];
    for (const node of ready) {
      for (const dependent of adjList.get(node) ?? []) {
        const newDeg = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDeg);
        if (newDeg === 0) nextReady.push(dependent);
      }
    }
    ready = nextReady;
  }

  return waves;
}

// ── Public API ────────────────────────────────────────────────────────────────

export class DependencyGraphBuilder {
  /**
   * Build a DependencyGraph from a list of SpecialistTasks.
   * Tasks with no dependsOn start in wave 0.
   * Tasks in the same wave are safe to execute concurrently.
   *
   * @throws Error if a dependency cycle is detected.
   */
  build(tasks: SpecialistTask[]): DependencyGraph {
    const nodes  = tasks.map(t => t.taskId);
    const edges: DependencyEdge[] = [];

    // adjList: node → list of nodes that depend on it
    const adjList = new Map<string, string[]>(nodes.map(n => [n, []]));

    for (const task of tasks) {
      for (const dep of task.dependsOn) {
        if (!adjList.has(dep)) {
          throw new Error(
            `[dep-graph] Task "${task.taskId}" depends on unknown task "${dep}".`
          );
        }
        edges.push({ from: task.taskId, dependsOn: dep });
        adjList.get(dep)!.push(task.taskId);
      }
    }

    const cycle = detectCycle(adjList, nodes);
    if (cycle) {
      throw new Error(
        `[dep-graph] Dependency cycle detected: ${cycle.join(" → ")}`
      );
    }

    const waves = computeWaves(nodes, adjList);

    return { nodes, edges, waves };
  }

  /** Compute the maximum parallel fan-out across all waves. */
  maxParallelism(graph: DependencyGraph): number {
    return Math.max(1, ...graph.waves.map(w => w.length));
  }

  /** Average parallelism factor (tasks per wave). */
  avgParallelism(graph: DependencyGraph): number {
    if (graph.waves.length === 0) return 0;
    const total = graph.waves.reduce((s, w) => s + w.length, 0);
    return total / graph.waves.length;
  }
}

export const dependencyGraphBuilder = new DependencyGraphBuilder();
