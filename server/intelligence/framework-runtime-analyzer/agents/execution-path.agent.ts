import type { AgentResult, ExecutionPathsData, FrameworkRuntimeInput } from '../types';
import { selectNodesByKind } from '../utils/ast-traversal.util';
import { buildEdgeTypeGraph } from '../utils/graph-builder.util';

export const analyzeExecutionPathAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<ExecutionPathsData> => {
  const branchGraph = buildEdgeTypeGraph(input.edges, 'branches');
  const conditionalNodes = selectNodesByKind(input.nodes, 'condition').map((node) => node.id);

  const branches = conditionalNodes.map((nodeId) => [nodeId, ...(branchGraph[nodeId] ?? [])]);

  return {
    logs: [`execution-path: mapped ${branches.length} conditional branches`],
    data: {
      branches,
      conditionalNodes,
    },
  };
};
