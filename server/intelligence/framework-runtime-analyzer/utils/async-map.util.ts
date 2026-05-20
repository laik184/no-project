import type { RuntimeEdge, RuntimeNode } from '../types';

export const mapAsyncChains = (nodes: RuntimeNode[], edges: RuntimeEdge[]): string[][] => {
  const asyncNodeIds = new Set(
    nodes
      .filter((node) => node.kind === 'async' || node.metadata?.isAsync === true)
      .map((node) => node.id),
  );

  const adjacency: Record<string, string[]> = {};
  for (const edge of edges.filter((item) => item.type === 'awaits' || item.type === 'calls')) {
    if (!adjacency[edge.from]) {
      adjacency[edge.from] = [];
    }

    adjacency[edge.from].push(edge.to);
  }

  const chains: string[][] = [];

  for (const nodeId of asyncNodeIds) {
    const queue: string[] = [nodeId];
    const chain: string[] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (asyncNodeIds.has(current)) {
        chain.push(current);
      }

      for (const next of adjacency[current] ?? []) {
        queue.push(next);
      }
    }

    if (chain.length > 1) {
      chains.push(chain);
    }
  }

  return chains;
};

export const detectParallelAsyncGroups = (edges: RuntimeEdge[]): string[][] => {
  const awaitsBySource: Record<string, string[]> = {};

  for (const edge of edges.filter((item) => item.type === 'awaits')) {
    if (!awaitsBySource[edge.from]) {
      awaitsBySource[edge.from] = [];
    }
    awaitsBySource[edge.from].push(edge.to);
  }

  return Object.values(awaitsBySource).filter((targets) => targets.length > 1);
};
