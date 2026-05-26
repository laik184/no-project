/**
 * server/agents/memory/vector/semantic-search.ts — STUB
 */

import type { MemoryEntry, SearchOptions, RankedMemory } from "./vector-types.ts";

export async function cacheMemory(_entry: MemoryEntry): Promise<void> {}

export async function semanticSearch(
  _opts: SearchOptions,
): Promise<RankedMemory[]> {
  return [];
}

export async function keywordSearch(
  _opts: SearchOptions,
): Promise<RankedMemory[]> {
  return [];
}
