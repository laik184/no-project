/**
 * server/memory/execution-memory/execution-store.ts
 *
 * Purpose: Persistent store for agent run execution records.
 * Responsibility: CRUD + run-based retrieval + success/failure analysis.
 * Exports: ExecutionStore, executionStore (singleton)
 */

import { BaseMemoryStore }    from '../core/memory-store.ts';
import type { ExecutionEntry } from '../types/entry.types.ts';
import type { CreateEntryInput } from '../types/memory.types.ts';

export interface CreateExecutionInput extends Omit<CreateEntryInput, 'category'> {
  runId:        string;
  goal:         string;
  agentType:    string;
  toolsUsed:    string[];
  durationMs:   number;
  success:      boolean;
  errorSummary?: string;
}

export class ExecutionStore extends BaseMemoryStore<ExecutionEntry> {
  constructor() { super('execution'); }

  async record(input: CreateExecutionInput): Promise<ExecutionEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'execution' },
      {
        runId:        input.runId,
        goal:         input.goal,
        agentType:    input.agentType,
        toolsUsed:    input.toolsUsed,
        durationMs:   input.durationMs,
        success:      input.success,
        errorSummary: input.errorSummary,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async byRun(runId: string): Promise<ExecutionEntry[]> {
    return [...this.store.values()].filter(e => e.runId === runId);
  }

  async failures(): Promise<ExecutionEntry[]> {
    return [...this.store.values()]
      .filter(e => !e.success)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async successRate(): Promise<number> {
    const all = [...this.store.values()];
    if (all.length === 0) return 0;
    return all.filter(e => e.success).length / all.length;
  }

  async avgDuration(): Promise<number> {
    const all = [...this.store.values()];
    if (all.length === 0) return 0;
    return all.reduce((sum, e) => sum + e.durationMs, 0) / all.length;
  }

  async byAgent(agentType: string): Promise<ExecutionEntry[]> {
    return [...this.store.values()].filter(e => e.agentType === agentType);
  }

  async recentFailures(limit = 5): Promise<ExecutionEntry[]> {
    return (await this.failures()).slice(0, limit);
  }
}

export const executionStore = new ExecutionStore();
