import type { DependencyGraph } from '../types/planning.types.ts';

export function buildAdjacencyList(
  edges: Array<{ from: string; to: string }>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const { from, to } of edges) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(to);
  }
  return adj;
}

export function topologicalSort(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
): string[] | null {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node, 0);
    adj.set(node, []);
  }

  for (const { from, to } of edges) {
    adj.get(from)?.push(to);
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node) ?? 0) === 0) queue.push(node);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  return result.length === nodes.length ? result : null;
}

export function hasCycle(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
): boolean {
  return topologicalSort(nodes, edges) === null;
}

export function buildDependencyGraph(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
): DependencyGraph {
  const order = topologicalSort(nodes, edges) ?? nodes;
  return { nodes, edges, topologicalOrder: order };
}

export function getDirectDependencies(
  nodeId: string,
  edges: Array<{ from: string; to: string }>,
): string[] {
  return edges.filter((e) => e.to === nodeId).map((e) => e.from);
}

export function getTransitiveDependencies(
  nodeId: string,
  edges: Array<{ from: string; to: string }>,
): string[] {
  const visited = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const { from, to } of edges) {
      if (to === current && !visited.has(from)) {
        visited.add(from);
        stack.push(from);
      }
    }
  }
  return Array.from(visited);
}
