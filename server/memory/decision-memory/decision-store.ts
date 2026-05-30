/**
 * server/memory/decision-memory/decision-store.ts
 *
 * Purpose: Persistent store for architectural and product decisions.
 * Responsibility: CRUD + domain-specific search for DecisionEntry records.
 * Exports: DecisionStore, decisionStore (singleton)
 */

import { BaseMemoryStore }    from '../core/memory-store.ts';
import type { DecisionEntry } from '../types/entry.types.ts';
import type { CreateEntryInput, UpdateEntryPatch } from '../types/memory.types.ts';

export interface CreateDecisionInput extends Omit<CreateEntryInput, 'category'> {
  context:   string;
  outcome:   string;
  rationale: string;
  impact:    DecisionEntry['impact'];
}

export class DecisionStore extends BaseMemoryStore<DecisionEntry> {
  constructor() { super('decision'); }

  async record(input: CreateDecisionInput): Promise<DecisionEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'decision' },
      {
        context:   input.context,
        outcome:   input.outcome,
        rationale: input.rationale,
        impact:    input.impact,
        reversed:  false,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async markReversed(id: string): Promise<DecisionEntry | undefined> {
    const entry = this.store.get(id);
    if (!entry) return undefined;
    const updated = { ...entry, reversed: true, updatedAt: Date.now() };
    this.store.set(id, updated);
    this.persist();
    return updated;
  }

  async byImpact(impact: DecisionEntry['impact']): Promise<DecisionEntry[]> {
    return [...this.store.values()].filter(e => e.impact === impact);
  }

  async searchByContext(context: string): Promise<DecisionEntry[]> {
    const q = context.toLowerCase();
    return [...this.store.values()].filter(
      e => e.context.toLowerCase().includes(q) ||
           e.rationale.toLowerCase().includes(q),
    );
  }
}

export const decisionStore = new DecisionStore();
