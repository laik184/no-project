import type { RuntimeNode } from '../types';

export const selectNodesByKind = (nodes: RuntimeNode[], kind: RuntimeNode['kind']): RuntimeNode[] => {
  return nodes.filter((node) => node.kind === kind);
};

export const selectNodesByMetadataFlag = (
  nodes: RuntimeNode[],
  flag: string,
): RuntimeNode[] => {
  return nodes.filter((node) => node.metadata?.[flag] === true);
};
