import type { AgentResult, FrameworkRuntimeInput } from '../types';
import { buildEdgeTypeGraph } from '../utils/graph-builder.util';

export interface DependencyRuntimeData {
  dynamicDependencies: string[];
  injectionFlows: string[][];
}

export const analyzeDependencyRuntimeAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<DependencyRuntimeData> => {
  const dynamicDependencies = input.nodes
    .filter((node) => node.kind === 'dependency' && node.metadata?.dynamicImport === true)
    .map((node) => node.id);

  const dependencyGraph = buildEdgeTypeGraph(input.edges, 'depends_on');
  const injectionFlows = Object.entries(dependencyGraph)
    .filter(([, targets]) => targets.length > 0)
    .map(([from, targets]) => [from, ...targets]);

  return {
    logs: [`dependency-runtime: found ${dynamicDependencies.length} dynamic dependencies`],
    data: {
      dynamicDependencies,
      injectionFlows,
    },
  };
};
