/**
 * server/memory/bug-memory/bug-store.ts
 *
 * Purpose: Persistent store for bug records, root causes, and fixes.
 * Responsibility: CRUD + recurrence tracking + resolution search.
 * Exports: BugStore, bugStore (singleton)
 */

import { BaseMemoryStore }  from '../core/memory-store.ts';
import type { BugEntry }    from '../types/entry.types.ts';
import type { CreateEntryInput } from '../types/memory.types.ts';

export interface CreateBugInput extends Omit<CreateEntryInput, 'category'> {
  errorType:   string;
  stackTrace?: string;
  rootCause:   string;
  fix:         string;
}

export class BugStore extends BaseMemoryStore<BugEntry> {
  constructor() { super('bug'); }

  async record(input: CreateBugInput): Promise<BugEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'bug' },
      {
        errorType:  input.errorType,
        stackTrace: input.stackTrace,
        rootCause:  input.rootCause,
        fix:        input.fix,
        recurrence: 1,
        resolved:   false,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  /** Increment recurrence counter for an existing bug. */
  async recordRecurrence(id: string): Promise<BugEntry | undefined> {
    const entry = this.store.get(id);
    if (!entry) return undefined;
    const updated = { ...entry, recurrence: entry.recurrence + 1, updatedAt: Date.now() };
    this.store.set(id, updated);
    this.persist();
    return updated;
  }

  async markResolved(id: string): Promise<BugEntry | undefined> {
    const entry = this.store.get(id);
    if (!entry) return undefined;
    const updated = { ...entry, resolved: true, updatedAt: Date.now() };
    this.store.set(id, updated);
    this.persist();
    return updated;
  }

  async unresolved(): Promise<BugEntry[]> {
    return [...this.store.values()].filter(e => !e.resolved);
  }

  async byErrorType(errorType: string): Promise<BugEntry[]> {
    const q = errorType.toLowerCase();
    return [...this.store.values()].filter(
      e => e.errorType.toLowerCase().includes(q),
    );
  }

  async topRecurring(limit = 10): Promise<BugEntry[]> {
    return [...this.store.values()]
      .sort((a, b) => b.recurrence - a.recurrence)
      .slice(0, limit);
  }

  /**
   * Find a bug that matches a given error signature.
   * Uses errorType + content fuzzy match.
   */
  async findSimilar(errorType: string, content: string): Promise<BugEntry | undefined> {
    const et = errorType.toLowerCase();
    const ct = content.toLowerCase().slice(0, 100);
    return [...this.store.values()].find(
      e => e.errorType.toLowerCase() === et ||
           e.content.toLowerCase().includes(ct),
    );
  }
}

export const bugStore = new BugStore();
