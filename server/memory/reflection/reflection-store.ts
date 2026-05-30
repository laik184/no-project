/**
 * server/memory/reflection/reflection-store.ts
 *
 * Purpose: Persistent store for reflection entries.
 * Responsibility: CRUD for ReflectionEntry records. Extends base store.
 * Exports: ReflectionStore, reflectionStore (singleton)
 */

import { BaseMemoryStore }      from '../core/memory-store.ts';
import type { ReflectionEntry } from '../types/entry.types.ts';
import type { CreateEntryInput } from '../types/memory.types.ts';

export interface CreateReflectionInput extends Omit<CreateEntryInput, 'category'> {
  sourceIds:   string[];
  mistake:     string;
  lesson:      string;
  improvement: string;
}

export class ReflectionStore extends BaseMemoryStore<ReflectionEntry> {
  constructor() { super('reflection'); }

  async record(input: CreateReflectionInput): Promise<ReflectionEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'reflection' },
      {
        sourceIds:   input.sourceIds,
        mistake:     input.mistake,
        lesson:      input.lesson,
        improvement: input.improvement,
        applied:     false,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async markApplied(id: string): Promise<ReflectionEntry | undefined> {
    const entry = this.store.get(id);
    if (!entry) return undefined;
    const updated = { ...entry, applied: true, updatedAt: Date.now() };
    this.store.set(id, updated);
    this.persist();
    return updated;
  }

  async unapplied(): Promise<ReflectionEntry[]> {
    return [...this.store.values()]
      .filter(e => !e.applied)
      .sort((a, b) => b.score - a.score);
  }

  async bySource(sourceId: string): Promise<ReflectionEntry[]> {
    return [...this.store.values()].filter(e => e.sourceIds.includes(sourceId));
  }

  async topLessons(limit = 5): Promise<ReflectionEntry[]> {
    return [...this.store.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const reflectionStore = new ReflectionStore();
