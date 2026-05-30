/**
 * server/memory/telemetry/telemetry-reporter.ts
 *
 * Purpose: Aggregate metrics into structured telemetry reports.
 * Responsibility: Read from memoryMetrics and all stores to produce reports.
 *   Read-only view — does not modify any state.
 * Exports: TelemetryReporter, telemetryReporter (singleton)
 */

import { memoryMetrics }    from './memory-metrics.ts';
import { memoryRegistry }   from '../core/memory-registry.ts';
import type { TelemetryReport, CategoryStats } from '../types/telemetry.types.ts';
import type { MemoryCategory } from '../types/memory.types.ts';

export class TelemetryReporter {

  async report(): Promise<TelemetryReport> {
    const categories = memoryRegistry.categories();
    const now        = Date.now();

    const byCategory: CategoryStats[] = await Promise.all(
      categories.map(async (cat): Promise<CategoryStats> => {
        const store   = memoryRegistry.get(cat);
        const entries = await store.list();
        const stale   = entries.filter(
          e => e.ttlMs && e.createdAt + e.ttlMs <= now,
        ).length;
        const avgScore = entries.length > 0
          ? entries.reduce((s, e) => s + e.score, 0) / entries.length
          : 0;
        const lastAccessed = entries.reduce(
          (max, e) => Math.max(max, e.updatedAt), 0,
        );
        return {
          category: cat,
          count:    entries.length,
          avgScore: parseFloat(avgScore.toFixed(3)),
          staleCount: stale,
          lastAccessed,
        };
      }),
    );

    const totalEntries = byCategory.reduce((s, c) => s + c.count, 0);
    const counters     = memoryMetrics.countersSnapshot();

    return {
      generatedAt:     now,
      totalEntries,
      byCategory,
      counters,
      p50LatencyMs:    memoryMetrics.p50(),
      p95LatencyMs:    memoryMetrics.p95(),
      searchHitRate:   parseFloat(memoryMetrics.hitRate().toFixed(3)),
      compressionRuns: counters['compression.run'] ?? 0,
      reflectionRuns:  counters['reflection.run']  ?? 0,
    };
  }

  async categoryReport(category: MemoryCategory): Promise<CategoryStats> {
    const now     = Date.now();
    const store   = memoryRegistry.get(category);
    const entries = await store.list();
    const stale   = entries.filter(
      e => e.ttlMs && e.createdAt + e.ttlMs <= now,
    ).length;
    const avgScore = entries.length > 0
      ? entries.reduce((s, e) => s + e.score, 0) / entries.length
      : 0;
    return {
      category,
      count:       entries.length,
      avgScore:    parseFloat(avgScore.toFixed(3)),
      staleCount:  stale,
      lastAccessed: entries.reduce((max, e) => Math.max(max, e.updatedAt), 0),
    };
  }
}

export const telemetryReporter = new TelemetryReporter();
