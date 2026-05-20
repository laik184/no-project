import type { AgentResult, FrameworkRuntimeInput } from '../types';
import { matchNodesByLabelPatterns } from '../utils/pattern-match.util';

export interface ErrorPropagationData {
  tryCatchFlows: string[];
  uncaughtErrors: string[];
}

export const analyzeErrorPropagationAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<ErrorPropagationData> => {
  const tryCatchFlows = matchNodesByLabelPatterns(input.nodes, [/try/i, /catch/i, /finally/i]);
  const uncaughtErrors = input.nodes
    .filter((node) => node.kind === 'error' && node.metadata?.caught !== true)
    .map((node) => node.id);

  return {
    logs: [`error-propagation: found ${uncaughtErrors.length} uncaught error paths`],
    data: {
      tryCatchFlows,
      uncaughtErrors,
    },
  };
};
