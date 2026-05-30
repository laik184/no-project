/**
 * server/memory/index.ts
 *
 * Purpose: Top-level public API for the Nura-X memory platform.
 * Responsibility: Single import point for all consumers.
 *   Re-exports the engine, bootstrap, and module surfaces.
 * Exports: memoryEngine, bootstrapMemory, and all sub-module exports
 */

// ── Bootstrap ─────────────────────────────────────────────────────────────────
export { bootstrapMemory }                  from './bootstrap.ts';

// ── Core engine (primary consumer API) ───────────────────────────────────────
export { memoryEngine, MemoryEngine }       from './core/memory-engine.ts';
export { memoryRouter, MemoryRouter }       from './core/memory-router.ts';
export { memoryRegistry, MemoryRegistry }   from './core/memory-registry.ts';
export { memoryManager, MemoryManager }     from './core/memory-manager.ts';

// ── Domain stores ─────────────────────────────────────────────────────────────
export { decisionStore }      from './decision-memory/index.ts';
export { architectureStore }  from './architecture-memory/index.ts';
export { bugStore }           from './bug-memory/index.ts';
export { businessStore }      from './business-memory/index.ts';
export { feedbackStore }      from './user-feedback-memory/index.ts';
export { revenueStore }       from './revenue-memory/index.ts';
export { learningStore, capabilityTracker } from './learning-memory/index.ts';
export { predictionStore }    from './prediction-memory/index.ts';
export { executionStore }     from './execution-memory/index.ts';
export { conversationStore }  from './conversation-memory/index.ts';

// ── Infrastructure layers ─────────────────────────────────────────────────────
export { graphStore, graphBuilder, graphTraversal } from './knowledge-graph/index.ts';
export { reflectionStore, reflectionEngine, lessonExtractor } from './reflection/index.ts';
export { retrievalEngine, semanticSearch, vectorSearch, hybridSearch, reranker } from './retrieval/index.ts';
export { compressionEngine, summarizer, clusterer, archiver } from './compression/index.ts';
export { checkpointManager, checkpointStore, snapshotBuilder } from './checkpoints/index.ts';
export { memoryMetrics, memoryEvents, telemetryReporter }      from './telemetry/index.ts';

// ── Context builder (public API for agents / orchestrators) ──────────────────
export { buildMemoryContext, buildMemoryContextString } from './context/memory-context-builder.ts';
export type { MemoryContext, ContextBuildOptions }      from './context/memory-context-builder.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type * from './types/index.ts';
