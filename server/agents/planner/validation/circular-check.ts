import type { DependencyGraph } from '../types/planning.types.ts';
import { hasCycle } from '../utils/graph-utils.ts';

export interface CircularCheckResult {
  hasCycles:      boolean;
  cyclicNodeIds:  string[];
  description:    string;
}

export function checkForCircularDependencies(graph: DependencyGraph): CircularCheckResult {
  const cyclic = hasCycle(graph.nodes, graph.edges);

  if (!cyclic) {
    return {
      hasCycles:     false,
      cyclicNodeIds: [],
      description:   'No circular dependencies detected.',
    };
  }

  const cyclicNodes = detectCyclicNodes(graph.nodes, graph.edges);

  return {
    hasCycles:     true,
    cyclicNodeIds: cyclicNodes,
    description:   `Circular dependency detected among ${cyclicNodes.length} node(s): ${cyclicNodes.join(', ')}`,
  };
}

function detectCyclicNodes(
  nodes: string[],
  edges: Array<{ from: string; to: string }>,
): string[] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(nodes.map((n) => [n, WHITE]));
  const adj   = new Map(nodes.map((n) => [n, [] as string[]]));
  const cyclic = new Set<string>();

  for (const { from, to } of edges) {
    adj.get(from)?.push(to);
  }

  function dfs(node: string): boolean {
    color.set(node, GRAY);
    for (const neighbor of adj.get(node) ?? []) {
      if (color.get(neighbor) === GRAY) {
        cyclic.add(node);
        cyclic.add(neighbor);
        return true;
      }
      if (color.get(neighbor) === WHITE && dfs(neighbor)) {
        cyclic.add(node);
      }
    }
    color.set(node, BLACK);
    return false;
  }

  for (const node of nodes) {
    if (color.get(node) === WHITE) dfs(node);
  }

  return Array.from(cyclic);
}
