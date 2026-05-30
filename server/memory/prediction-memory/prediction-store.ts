/**
 * server/memory/prediction-memory/prediction-store.ts
 *
 * Purpose: Persistent store for predictions and outcome tracking.
 * Responsibility: CRUD + outcome resolution + accuracy metrics.
 * Exports: PredictionStore, predictionStore (singleton)
 */

import { BaseMemoryStore }      from '../core/memory-store.ts';
import type { PredictionEntry } from '../types/entry.types.ts';
import type { CreateEntryInput } from '../types/memory.types.ts';

export interface CreatePredictionInput extends Omit<CreateEntryInput, 'category'> {
  subject:     string;
  prediction:  string;
  confidence:  number;
  horizon:     string;
}

export class PredictionStore extends BaseMemoryStore<PredictionEntry> {
  constructor() { super('prediction'); }

  async record(input: CreatePredictionInput): Promise<PredictionEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'prediction' },
      {
        subject:    input.subject,
        prediction: input.prediction,
        confidence: Math.min(1, Math.max(0, input.confidence)),
        horizon:    input.horizon,
        outcome:    'pending',
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async resolveOutcome(
    id:      string,
    outcome: PredictionEntry['outcome'],
  ): Promise<PredictionEntry | undefined> {
    const entry = this.store.get(id);
    if (!entry) return undefined;
    const updated = { ...entry, outcome, updatedAt: Date.now() };
    this.store.set(id, updated);
    this.persist();
    return updated;
  }

  async pending(): Promise<PredictionEntry[]> {
    return [...this.store.values()].filter(e => e.outcome === 'pending');
  }

  async accuracyRate(): Promise<number> {
    const resolved = [...this.store.values()].filter(
      e => e.outcome && e.outcome !== 'pending',
    );
    if (resolved.length === 0) return 0;
    const correct = resolved.filter(e => e.outcome === 'correct').length;
    return correct / resolved.length;
  }

  async bySubject(subject: string): Promise<PredictionEntry[]> {
    const q = subject.toLowerCase();
    return [...this.store.values()].filter(
      e => e.subject.toLowerCase().includes(q),
    );
  }
}

export const predictionStore = new PredictionStore();
