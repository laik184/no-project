import { PriorityItem } from "../types";

const LEVEL_ORDER: Record<string, number> = {
  critical: 3,
  high:     2,
  medium:   1,
  low:      0,
};

export function sortByPriority(items: readonly PriorityItem[]): PriorityItem[] {
  return [...items].sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    const levelDiff = (LEVEL_ORDER[b.level] ?? 0) - (LEVEL_ORDER[a.level] ?? 0);
    if (levelDiff !== 0) return levelDiff;
    return a.taskId.localeCompare(b.taskId);
  });
}

export function buildPriorityMap(
  items: readonly PriorityItem[]
): Readonly<Record<string, PriorityItem>> {
  const map: Record<string, PriorityItem> = {};
  for (const item of items) {
    map[item.taskId] = item;
  }
  return Object.freeze(map);
}

export function topN(items: readonly PriorityItem[], n: number): readonly PriorityItem[] {
  return sortByPriority(items).slice(0, n);
}
