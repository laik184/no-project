export const topologicalLikeOrder = (
  graph: Record<string, string[]>,
  entryNodeIds: string[],
): string[] => {
  const visited = new Set<string>();
  const order: string[] = [];

  const walk = (nodeId: string): void => {
    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    order.push(nodeId);

    for (const next of graph[nodeId] ?? []) {
      walk(next);
    }
  };

  for (const entryNodeId of entryNodeIds) {
    walk(entryNodeId);
  }

  return order;
};

export const collectAllPaths = (
  graph: Record<string, string[]>,
  entryNodeIds: string[],
): string[][] => {
  const paths: string[][] = [];

  const walk = (nodeId: string, trail: string[]): void => {
    const nextTrail = [...trail, nodeId];
    const children = graph[nodeId] ?? [];

    if (children.length === 0) {
      paths.push(nextTrail);
      return;
    }

    for (const child of children) {
      if (nextTrail.includes(child)) {
        paths.push([...nextTrail, child]);
        continue;
      }

      walk(child, nextTrail);
    }
  };

  for (const entryNodeId of entryNodeIds) {
    walk(entryNodeId, []);
  }

  return paths;
};
