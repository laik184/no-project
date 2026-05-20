export function buildAdjacency(edges: readonly { from: string; to: string }[]): Record<string, string[]> {
  const adjacency: Record<string, string[]> = {};

  for (const edge of edges) {
    if (!adjacency[edge.from]) {
      adjacency[edge.from] = [];
    }

    adjacency[edge.from].push(edge.to);
  }

  return adjacency;
}

export function detectCycles(edges: readonly { from: string; to: string }[]): string[][] {
  const adjacency = buildAdjacency(edges);
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const next of adjacency[node] ?? []) {
      if (!visited.has(next)) {
        dfs(next, [...path]);
      } else if (stack.has(next)) {
        const startIndex = path.indexOf(next);
        cycles.push(path.slice(startIndex));
      }
    }

    stack.delete(node);
  }

  for (const node of Object.keys(adjacency)) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

export function nodeDegreeMap(edges: readonly { from: string; to: string }[]): Record<string, number> {
  const map: Record<string, number> = {};

  for (const edge of edges) {
    map[edge.from] = (map[edge.from] ?? 0) + 1;
    map[edge.to] = (map[edge.to] ?? 0) + 1;
  }

  return map;
}
