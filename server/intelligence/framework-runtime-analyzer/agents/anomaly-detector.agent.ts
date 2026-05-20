import type { AgentResult, FrameworkRuntimeInput } from '../types';

const hasCycle = (graph: Record<string, string[]>): boolean => {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const walk = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (const next of graph[nodeId] ?? []) {
      if (walk(next)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return Object.keys(graph).some((nodeId) => walk(nodeId));
};

export const analyzeAnomalyDetectorAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<string[]> => {
  const anomalies: string[] = [];

  const callGraph: Record<string, string[]> = {};
  for (const edge of input.edges.filter((item) => item.type === 'calls' || item.type === 'awaits')) {
    if (!callGraph[edge.from]) {
      callGraph[edge.from] = [];
    }
    callGraph[edge.from].push(edge.to);
  }

  if (hasCycle(callGraph)) {
    anomalies.push('Potential infinite loop or recursive deadlock detected in execution graph');
  }

  const raceCandidates = input.nodes.filter((node) => node.metadata?.sharedResource === true);
  if (raceCandidates.length > 1) {
    anomalies.push('Potential race condition on shared runtime resource');
  }

  const blockingAsyncCount = input.nodes.filter(
    (node) => node.kind === 'async' && node.metadata?.blocking === true,
  ).length;
  if (blockingAsyncCount > 0) {
    anomalies.push('Potential deadlock risk due to blocking async dependencies');
  }

  const leakCandidates = input.nodes.filter((node) => node.metadata?.unboundedListener === true).length;
  if (leakCandidates > 0) {
    anomalies.push('Potential memory leak pattern: unbounded listener/subscription growth');
  }

  return {
    logs: [`anomaly-detector: detected ${anomalies.length} anomalies`],
    data: anomalies,
  };
};
