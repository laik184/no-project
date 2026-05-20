import type { AgentResult, FrameworkRuntimeInput, RuntimeFlowData } from '../types';
import { collectAllPaths, topologicalLikeOrder } from '../utils/callstack.util';
import { buildEdgeTypeGraph } from '../utils/graph-builder.util';

export const analyzeRuntimeFlowAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<RuntimeFlowData> => {
  const callGraph = buildEdgeTypeGraph(input.edges, 'calls');
  const entryNodeIds = input.entryPoints.map((entry) => entry.id);
  const executionOrder = topologicalLikeOrder(callGraph, entryNodeIds);
  const entryToExitPaths = collectAllPaths(callGraph, entryNodeIds);

  return {
    logs: [
      `runtime-flow: built call graph with ${Object.keys(callGraph).length} nodes`,
      `runtime-flow: traced ${entryToExitPaths.length} entry-to-exit paths`,
    ],
    data: {
      callGraph,
      executionOrder,
      entryToExitPaths,
    },
  };
};
