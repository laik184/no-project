import type { AgentResult, AsyncFlowData, FrameworkRuntimeInput } from '../types';
import { detectParallelAsyncGroups, mapAsyncChains } from '../utils/async-map.util';

export const analyzeAsyncFlowAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<AsyncFlowData> => {
  const chains = mapAsyncChains(input.nodes, input.edges);
  const parallelGroups = detectParallelAsyncGroups(input.edges);

  return {
    logs: [
      `async-flow: detected ${chains.length} async chains`,
      `async-flow: detected ${parallelGroups.length} parallel groups`,
    ],
    data: {
      chains,
      parallelGroups,
    },
  };
};
