/**
 * server/memory/types/telemetry.types.ts
 *
 * Purpose: Type contracts for the memory telemetry subsystem.
 * Responsibility: Metric, event, and reporting interfaces. No runtime logic.
 * Exports: MemoryMetric, MemoryEvent, TelemetryReport
 */

import type { MemoryCategory } from './memory.types.ts';

// ── Metric ────────────────────────────────────────────────────────────────────

export type MetricKind =
  | 'store.create'
  | 'store.update'
  | 'store.delete'
  | 'store.read'
  | 'search.query'
  | 'search.miss'
  | 'search.hit'
  | 'retrieval.latency'
  | 'compression.run'
  | 'reflection.run'
  | 'graph.entity_added'
  | 'graph.relationship_added'
  | 'checkpoint.saved'
  | 'checkpoint.restored'
  | 'learning.lesson_added'
  | 'memory.stale_evicted';

export interface MemoryMetric {
  kind:      MetricKind;
  category?: MemoryCategory;
  value:     number;
  timestamp: number;   // Unix ms
  meta?:     Record<string, unknown>;
}

// ── Event ─────────────────────────────────────────────────────────────────────

export type MemoryEventType =
  | 'entry.created'
  | 'entry.updated'
  | 'entry.deleted'
  | 'search.completed'
  | 'reflection.completed'
  | 'compression.completed'
  | 'checkpoint.saved'
  | 'checkpoint.restored'
  | 'graph.updated';

export interface MemoryEvent {
  type:      MemoryEventType;
  category?: MemoryCategory;
  entryId?:  string;
  runId?:    string;
  timestamp: number;
  data?:     Record<string, unknown>;
}

// ── Counter map ───────────────────────────────────────────────────────────────

export type MetricCounters = Record<string, number>;

// ── Per-category stats ────────────────────────────────────────────────────────

export interface CategoryStats {
  category:     MemoryCategory;
  count:        number;
  avgScore:     number;
  staleCount:   number;
  lastAccessed: number;
}

// ── Telemetry report ──────────────────────────────────────────────────────────

export interface TelemetryReport {
  generatedAt:    number;
  totalEntries:   number;
  byCategory:     CategoryStats[];
  counters:       MetricCounters;
  p50LatencyMs:   number;
  p95LatencyMs:   number;
  searchHitRate:  number;   // hits / (hits + misses)
  compressionRuns: number;
  reflectionRuns:  number;
}
