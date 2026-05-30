/**
 * server/memory/architecture-memory/architecture-store.ts
 *
 * Purpose: Persistent store for architectural patterns and component knowledge.
 * Responsibility: CRUD + domain-specific search for ArchitectureEntry records.
 * Exports: ArchitectureStore, architectureStore (singleton)
 */

import { BaseMemoryStore }         from '../core/memory-store.ts';
import type { ArchitectureEntry }  from '../types/entry.types.ts';
import type { CreateEntryInput }   from '../types/memory.types.ts';

export interface CreateArchitectureInput extends Omit<CreateEntryInput, 'category'> {
  component:   string;
  pattern:     string;
  tradeoffs:   string[];
  constraints: string[];
}

export class ArchitectureStore extends BaseMemoryStore<ArchitectureEntry> {
  constructor() { super('architecture'); }

  async record(input: CreateArchitectureInput): Promise<ArchitectureEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'architecture' },
      {
        component:   input.component,
        pattern:     input.pattern,
        tradeoffs:   input.tradeoffs,
        constraints: input.constraints,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async byComponent(component: string): Promise<ArchitectureEntry[]> {
    const q = component.toLowerCase();
    return [...this.store.values()].filter(
      e => e.component.toLowerCase().includes(q),
    );
  }

  async byPattern(pattern: string): Promise<ArchitectureEntry[]> {
    const q = pattern.toLowerCase();
    return [...this.store.values()].filter(
      e => e.pattern.toLowerCase().includes(q),
    );
  }

  async withConstraint(constraint: string): Promise<ArchitectureEntry[]> {
    const q = constraint.toLowerCase();
    return [...this.store.values()].filter(
      e => e.constraints.some(c => c.toLowerCase().includes(q)),
    );
  }
}

export const architectureStore = new ArchitectureStore();
