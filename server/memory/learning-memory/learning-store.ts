/**
 * server/memory/learning-memory/learning-store.ts
 *
 * Purpose: Persistent store for execution lessons and learned knowledge.
 * Responsibility: CRUD + domain-specific lesson retrieval and validation.
 * Exports: LearningStore, learningStore (singleton)
 */

import { BaseMemoryStore }    from '../core/memory-store.ts';
import type { LearningEntry } from '../types/entry.types.ts';
import type { CreateEntryInput } from '../types/memory.types.ts';

export interface CreateLearningInput extends Omit<CreateEntryInput, 'category'> {
  lesson:      string;
  domain:      string;
  appliedFrom: string;
  validated?:  boolean;
}

export class LearningStore extends BaseMemoryStore<LearningEntry> {
  constructor() { super('learning'); }

  async record(input: CreateLearningInput): Promise<LearningEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'learning' },
      {
        lesson:      input.lesson,
        domain:      input.domain,
        appliedFrom: input.appliedFrom,
        validated:   input.validated ?? false,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async validate(id: string): Promise<LearningEntry | undefined> {
    const entry = this.store.get(id);
    if (!entry) return undefined;
    const updated = {
      ...entry,
      validated: true,
      score:     Math.min(entry.score + 0.1, 1),
      updatedAt: Date.now(),
    };
    this.store.set(id, updated);
    this.persist();
    return updated;
  }

  async byDomain(domain: string): Promise<LearningEntry[]> {
    const q = domain.toLowerCase();
    return [...this.store.values()].filter(
      e => e.domain.toLowerCase().includes(q),
    );
  }

  async validated(): Promise<LearningEntry[]> {
    return [...this.store.values()]
      .filter(e => e.validated)
      .sort((a, b) => b.score - a.score);
  }

  async fromRun(runId: string): Promise<LearningEntry[]> {
    return [...this.store.values()].filter(e => e.appliedFrom === runId);
  }

  async topLessons(limit = 10): Promise<LearningEntry[]> {
    return [...this.store.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const learningStore = new LearningStore();
