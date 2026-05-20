import type { RuntimeEdge } from '../types';

export const buildAdjacencyGraph = (edges: RuntimeEdge[]): Record<string, string[]> => {
  const graph: Record<string, string[]> = {};

  for (const edge of edges) {
    if (!graph[edge.from]) {
      graph[edge.from] = [];
    }

    graph[edge.from].push(edge.to);

    if (!graph[edge.to]) {
      graph[edge.to] = [];
    }
  }

  return graph;
};

export const buildEdgeTypeGraph = (
  edges: RuntimeEdge[],
  type: RuntimeEdge['type'],
): Record<string, string[]> => {
  return buildAdjacencyGraph(edges.filter((edge) => edge.type === type));
};
