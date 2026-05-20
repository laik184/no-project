import type { AgentResult, FrameworkRuntimeInput } from '../types';
import { selectNodesByKind } from '../utils/ast-traversal.util';
import { buildEdgeTypeGraph } from '../utils/graph-builder.util';

export interface MiddlewareChainData {
  order: string[][];
  blocking: string[];
}

export const analyzeMiddlewareChainAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<MiddlewareChainData> => {
  const middlewareIds = new Set(selectNodesByKind(input.nodes, 'middleware').map((node) => node.id));
  const callGraph = buildEdgeTypeGraph(input.edges, 'calls');

  const order = Array.from(middlewareIds).map((nodeId) => [nodeId, ...(callGraph[nodeId] ?? [])]);
  const blocking = input.nodes
    .filter((node) => middlewareIds.has(node.id) && node.metadata?.blocks === true)
    .map((node) => node.id);

  return {
    logs: [`middleware-chain: mapped ${order.length} middleware sequences`],
    data: { order, blocking },
  };
};
