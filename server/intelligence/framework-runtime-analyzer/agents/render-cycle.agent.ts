import type { AgentResult, FrameworkRuntimeInput } from '../types';

export interface RenderCycleData {
  triggers: string[];
  unnecessaryRenders: string[];
}

export const analyzeRenderCycleAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<RenderCycleData> => {
  const reactRenderNodes = input.nodes.filter(
    (node) => node.framework === 'react' && (node.kind === 'render' || /render/i.test(node.label)),
  );

  const triggers = reactRenderNodes.map((node) => node.id);
  const unnecessaryRenders = reactRenderNodes
    .filter((node) => node.metadata?.memoized === false || node.metadata?.rerenderCount === 'high')
    .map((node) => node.id);

  return {
    logs: [`render-cycle: found ${triggers.length} render triggers`],
    data: {
      triggers,
      unnecessaryRenders,
    },
  };
};
