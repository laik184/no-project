import type { AgentResult, FrameworkRuntimeInput } from '../types';
import { selectNodesByKind, selectNodesByMetadataFlag } from '../utils/ast-traversal.util';

export interface StateMutationData {
  mutableStateNodes: string[];
  unsafeUpdates: string[];
}

export const analyzeStateMutationAgent = (
  input: FrameworkRuntimeInput,
): AgentResult<StateMutationData> => {
  const stateNodes = selectNodesByKind(input.nodes, 'state');
  const mutableStateNodes = stateNodes
    .filter((node) => node.metadata?.mutable === true)
    .map((node) => node.id);

  const unsafeUpdates = selectNodesByMetadataFlag(input.nodes, 'unsafeStateUpdate').map((node) => node.id);

  return {
    logs: [`state-mutation: detected ${mutableStateNodes.length} mutable state nodes`],
    data: {
      mutableStateNodes,
      unsafeUpdates,
    },
  };
};
