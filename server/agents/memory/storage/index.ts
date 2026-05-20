/**
 * server/memory/storage/index.ts
 *
 * Public API for the semantic memory PostgreSQL storage layer.
 */

export {
  initVectorStore,
  storeMemory,
  loadMemories,
  updateUsedCount,
  deleteMemory,
  getMemoryStats,
}                           from "./pgvector-store.ts";
export { indexMemory, indexRunLearnings }       from "./memory-indexer.ts";
export { runCleanup, startCleanupScheduler, stopCleanupScheduler } from "./memory-cleaner.ts";

export type { CleanupResult }  from "./memory-cleaner.ts";
export type { IndexOptions }   from "./memory-indexer.ts";
