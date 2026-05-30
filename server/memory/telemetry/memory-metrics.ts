/**
 * server/memory/telemetry/memory-metrics.ts
 *
 * Purpose: Collect and expose operational metrics for the memory platform.
 * Responsibility: Counter increments, latency recording, aggregation.
 *   No external dependency — pure in-process instrumentation.
 * Exports: MemoryMetrics, memoryMetrics (singleton)
 */

import type { MetricKind, MemoryMetric, MetricCounters } from '../types/telemetry.types.ts';
import type { MemoryCategory } from '../types/memory.types.ts';

// ── Latency ring buffer ───────────────────────────────────────────────────────

class LatencyBuffer {
  private readonly buf: number[] = [];
  private readonly cap: number;

  constructor(capacity = 1000) { this.cap = capacity; }

  record(ms: number): void {
    if (this.buf.length >= this.cap) this.buf.shift();
    this.buf.push(ms);
  }

  percentile(p: number): number {
    if (this.buf.length === 0) return 0;
    const sorted = [...this.buf].sort((a, b) => a - b);
    const idx    = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
}

// ── Metrics collector ─────────────────────────────────────────────────────────

export class MemoryMetrics {
  private counters  = new Map<string, number>();
  private latencies = new LatencyBuffer(2000);
  private recent:   MemoryMetric[] = [];
  private readonly maxRecent = 500;

  increment(
    kind:     MetricKind,
    category?: MemoryCategory,
    value = 1,
  ): void {
    const key = category ? `${kind}:${category}` : kind;
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);

    const metric: MemoryMetric = {
      kind,
      category,
      value,
      timestamp: Date.now(),
    };
    if (this.recent.length >= this.maxRecent) this.recent.shift();
    this.recent.push(metric);
  }

  recordLatency(ms: number): void {
    this.latencies.record(ms);
    this.increment('retrieval.latency', undefined, ms);
  }

  countersSnapshot(): MetricCounters {
    return Object.fromEntries(this.counters);
  }

  p50(): number { return this.latencies.percentile(50); }
  p95(): number { return this.latencies.percentile(95); }

  recentMetrics(kind?: MetricKind): MemoryMetric[] {
    return kind
      ? this.recent.filter(m => m.kind === kind)
      : [...this.recent];
  }

  hitRate(): number {
    const hits   = this.counters.get('search.hit')  ?? 0;
    const misses = this.counters.get('search.miss') ?? 0;
    const total  = hits + misses;
    return total === 0 ? 0 : hits / total;
  }

  reset(): void {
    this.counters.clear();
    this.recent = [];
  }
}

export const memoryMetrics = new MemoryMetrics();
