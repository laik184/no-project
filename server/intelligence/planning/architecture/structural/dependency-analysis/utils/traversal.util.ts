import type { AdjMap } from "./graph.util.js";

export interface DfsResult {
  readonly visited:   readonly string[];
  readonly order:     readonly string[];
  readonly backEdges: readonly [string, string][];
}

export function dfs(
  startIds: readonly string[],
  adj:      AdjMap,
  allIds:   readonly string[],
): DfsResult {
  const visited   = new Set<string>();
  const order:    string[] = [];
  const backEdges: [string, string][] = [];
  const inStack   = new Set<string>();

  function visit(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    for (const neighbor of adj.get(id) ?? []) {
      if (inStack.has(neighbor)) {
        backEdges.push([id, neighbor]);
      } else {
        visit(neighbor);
      }
    }
    inStack.delete(id);
    order.push(id);
  }

  const seeds = startIds.length > 0 ? startIds : allIds;
  for (const id of seeds) visit(id);

  return Object.freeze({
    visited:   Object.freeze([...visited]),
    order:     Object.freeze([...order]),
    backEdges: Object.freeze(backEdges.map((e) => Object.freeze(e) as [string, string])),
  });
}

export function bfs(
  startId: string,
  adj:     AdjMap,
): readonly string[] {
  const visited = new Set<string>([startId]);
  const queue   = [startId];
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return Object.freeze(result);
}

export function topologicalSort(
  nodeIds: readonly string[],
  adj:     AdjMap,
): readonly string[] | null {
  const inDeg = new Map<string, number>();
  for (const id of nodeIds) inDeg.set(id, 0);
  for (const id of nodeIds) {
    for (const neighbor of adj.get(id) ?? []) {
      inDeg.set(neighbor, (inDeg.get(neighbor) ?? 0) + 1);
    }
  }

  const queue = nodeIds.filter((id) => (inDeg.get(id) ?? 0) === 0);
  const result: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const deg = (inDeg.get(neighbor) ?? 0) - 1;
      inDeg.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  return result.length === nodeIds.length ? Object.freeze(result) : null;
}

export function longestPath(
  nodeIds: readonly string[],
  adj:     AdjMap,
): number {
  const topo = topologicalSort(nodeIds, adj);
  if (!topo) return -1;

  const dist = new Map<string, number>(topo.map((id) => [id, 0]));
  for (const id of topo) {
    const d = dist.get(id) ?? 0;
    for (const neighbor of adj.get(id) ?? []) {
      const current = dist.get(neighbor) ?? 0;
      if (d + 1 > current) dist.set(neighbor, d + 1);
    }
  }

  let max = 0;
  for (const v of dist.values()) if (v > max) max = v;
  return max;
}

export function weaklyConnectedComponents(
  nodeIds: readonly string[],
  adj:     AdjMap,
  revAdj:  AdjMap,
): readonly (readonly string[])[] {
  const visited    = new Set<string>();
  const components: string[][] = [];

  function visitUndirected(id: string, component: string[]): void {
    if (visited.has(id)) return;
    visited.add(id);
    component.push(id);
    for (const n of adj.get(id)    ?? []) visitUndirected(n, component);
    for (const n of revAdj.get(id) ?? []) visitUndirected(n, component);
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      const component: string[] = [];
      visitUndirected(id, component);
      components.push(component);
    }
  }

  return Object.freeze(components.map((c) => Object.freeze(c)));
}
