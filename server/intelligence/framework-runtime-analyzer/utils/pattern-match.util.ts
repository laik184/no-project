import type { RuntimeFramework, RuntimeNode } from '../types';

export const matchNodesByLabelPatterns = (
  nodes: RuntimeNode[],
  patterns: RegExp[],
): string[] => {
  return nodes
    .filter((node) => patterns.some((pattern) => pattern.test(node.label)))
    .map((node) => node.id);
};

export const groupByFramework = (nodes: RuntimeNode[]): Record<RuntimeFramework, RuntimeNode[]> => {
  const grouped: Record<RuntimeFramework, RuntimeNode[]> = {
    express: [],
    nestjs: [],
    react: [],
    nextjs: [],
    unknown: [],
  };

  for (const node of nodes) {
    grouped[node.framework].push(node);
  }

  return grouped;
};
