/**
 * server/memory/user-feedback-memory/feedback-store.ts
 *
 * Purpose: Persistent store for user feedback entries.
 * Responsibility: CRUD + sentiment/actionable filtering.
 * Exports: FeedbackStore, feedbackStore (singleton)
 */

import { BaseMemoryStore }   from '../core/memory-store.ts';
import type { FeedbackEntry } from '../types/entry.types.ts';
import type { CreateEntryInput } from '../types/memory.types.ts';

export interface CreateFeedbackInput extends Omit<CreateEntryInput, 'category'> {
  sentiment:  FeedbackEntry['sentiment'];
  feature:    string;
  verbatim:   string;
  actionable: boolean;
}

export class FeedbackStore extends BaseMemoryStore<FeedbackEntry> {
  constructor() { super('user-feedback'); }

  async record(input: CreateFeedbackInput): Promise<FeedbackEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'user-feedback' },
      {
        sentiment:  input.sentiment,
        feature:    input.feature,
        verbatim:   input.verbatim,
        actionable: input.actionable,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async bySentiment(sentiment: FeedbackEntry['sentiment']): Promise<FeedbackEntry[]> {
    return [...this.store.values()].filter(e => e.sentiment === sentiment);
  }

  async actionableItems(): Promise<FeedbackEntry[]> {
    return [...this.store.values()].filter(e => e.actionable);
  }

  async byFeature(feature: string): Promise<FeedbackEntry[]> {
    const q = feature.toLowerCase();
    return [...this.store.values()].filter(
      e => e.feature.toLowerCase().includes(q),
    );
  }

  async sentimentBreakdown(): Promise<Record<FeedbackEntry['sentiment'], number>> {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    for (const e of this.store.values()) counts[e.sentiment]++;
    return counts;
  }
}

export const feedbackStore = new FeedbackStore();
