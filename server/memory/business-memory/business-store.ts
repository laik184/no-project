/**
 * server/memory/business-memory/business-store.ts
 *
 * Purpose: Persistent store for business insights and domain knowledge.
 * Responsibility: CRUD + domain/confidence-based retrieval.
 * Exports: BusinessStore, businessStore (singleton)
 */

import { BaseMemoryStore }    from '../core/memory-store.ts';
import type { BusinessEntry } from '../types/entry.types.ts';
import type { CreateEntryInput } from '../types/memory.types.ts';

export interface CreateBusinessInput extends Omit<CreateEntryInput, 'category'> {
  domain:     string;
  insight:    string;
  source:     string;
  confidence: number;
}

export class BusinessStore extends BaseMemoryStore<BusinessEntry> {
  constructor() { super('business'); }

  async record(input: CreateBusinessInput): Promise<BusinessEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'business' },
      {
        domain:     input.domain,
        insight:    input.insight,
        source:     input.source,
        confidence: Math.min(1, Math.max(0, input.confidence)),
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async byDomain(domain: string): Promise<BusinessEntry[]> {
    const q = domain.toLowerCase();
    return [...this.store.values()].filter(
      e => e.domain.toLowerCase().includes(q),
    );
  }

  async highConfidence(threshold = 0.7): Promise<BusinessEntry[]> {
    return [...this.store.values()]
      .filter(e => e.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence);
  }
}

export const businessStore = new BusinessStore();
