/**
 * server/memory/revenue-memory/revenue-store.ts
 *
 * Purpose: Persistent store for revenue metrics and financial signals.
 * Responsibility: CRUD + metric/period/trend filtering.
 * Exports: RevenueStore, revenueStore (singleton)
 */

import { BaseMemoryStore }  from '../core/memory-store.ts';
import type { RevenueEntry } from '../types/entry.types.ts';
import type { CreateEntryInput } from '../types/memory.types.ts';

export interface CreateRevenueInput extends Omit<CreateEntryInput, 'category'> {
  metric:   string;
  value:    number;
  currency: string;
  period:   string;
  trend:    RevenueEntry['trend'];
}

export class RevenueStore extends BaseMemoryStore<RevenueEntry> {
  constructor() { super('revenue'); }

  async record(input: CreateRevenueInput): Promise<RevenueEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'revenue' },
      {
        metric:   input.metric,
        value:    input.value,
        currency: input.currency,
        period:   input.period,
        trend:    input.trend,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async byPeriod(period: string): Promise<RevenueEntry[]> {
    return [...this.store.values()].filter(e => e.period === period);
  }

  async byMetric(metric: string): Promise<RevenueEntry[]> {
    const q = metric.toLowerCase();
    return [...this.store.values()].filter(
      e => e.metric.toLowerCase().includes(q),
    );
  }

  async byTrend(trend: RevenueEntry['trend']): Promise<RevenueEntry[]> {
    return [...this.store.values()].filter(e => e.trend === trend);
  }

  async latestPerMetric(): Promise<Map<string, RevenueEntry>> {
    const map = new Map<string, RevenueEntry>();
    const sorted = [...this.store.values()].sort((a, b) => b.createdAt - a.createdAt);
    for (const e of sorted) {
      if (!map.has(e.metric)) map.set(e.metric, e);
    }
    return map;
  }
}

export const revenueStore = new RevenueStore();
