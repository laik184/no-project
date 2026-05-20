/**
 * server/memory/vector/index.ts
 *
 * Public API for the semantic memory vector layer.
 * Distinct from the existing memory/ root index — this is the new vector engine.
 */

export { generateEmbedding, generateEmbeddings, cosineSimilarity } from "./embedding-engine.ts";
export { semanticSearch, keywordSearch, cacheMemory, clearAllCache } from "./semantic-search.ts";
export { rankMemories, deduplicateRanked, computeFinalScore, recencyScore, usageScore } from "./memory-ranking.ts";
export {
  temporalMultiplier, isOnCooldown, markRetrieved,
  clearSessionCache, filterByTimeWindow, isTooOld,
}                                                                    from "./temporal-weighting.ts";
export { buildContextInjection, buildMemoryBlock, buildRunSummary }  from "./context-builder.ts";

export type {
  MemoryEntry, MemoryCategory, EmbeddingResult,
  SearchOptions, RankedMemory, VectorStoreStats,
  EMBEDDING_MODEL, EMBEDDING_DIM, SCORE_WEIGHTS,
}                                                                    from "./vector-types.ts";
export type { MemoryBlock, ContextInjectionResult }                  from "./context-builder.ts";
