/**
 * server/memory/core/memory-types.ts
 *
 * Purpose: Re-exports all shared types for consumers inside the core layer.
 * Responsibility: Single import point for core modules. No new definitions.
 * Exports: all types from server/memory/types/
 */

export type {
  MemoryEntry,
  MemoryCategory,
  MemoryStore,
  MemoryFilter,
  CreateEntryInput,
  UpdateEntryPatch,
  BulkResult,
} from '../types/memory.types.ts';

export type {
  DecisionEntry,
  ArchitectureEntry,
  BugEntry,
  BusinessEntry,
  FeedbackEntry,
  RevenueEntry,
  LearningEntry,
  PredictionEntry,
  ExecutionEntry,
  ConversationEntry,
  ReflectionEntry,
} from '../types/entry.types.ts';

export type {
  SearchQuery,
  SearchResult,
  RankedResult,
  RetrievalMode,
  TermVector,
  HybridWeights,
} from '../types/search.types.ts';

export type {
  GraphEntity,
  GraphRelationship,
  GraphQuery,
  GraphPath,
  GraphStats,
  CreateEntityInput,
  CreateRelationshipInput,
  EntityKind,
  RelationshipKind,
} from '../types/graph.types.ts';

export type {
  MemoryMetric,
  MemoryEvent,
  TelemetryReport,
  CategoryStats,
  MetricCounters,
  MetricKind,
  MemoryEventType,
} from '../types/telemetry.types.ts';
