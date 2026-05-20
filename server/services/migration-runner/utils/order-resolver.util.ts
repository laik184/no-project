import { MigrationScript } from '../types.js';

export const resolveExecutionOrder = (scripts: MigrationScript[]): MigrationScript[] => {
  const seen = new Set<string>();

  for (const script of scripts) {
    if (seen.has(script.name)) {
      throw new Error(`Duplicate migration detected: ${script.name}`);
    }

    seen.add(script.name);
  }

  return [...scripts].sort((left, right) => left.name.localeCompare(right.name));
};
