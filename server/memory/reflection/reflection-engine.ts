/**
 * server/memory/reflection/reflection-engine.ts
 *
 * Purpose: Drives the reflection process by consuming bug and execution memories.
 * Responsibility: Orchestrates lesson extraction + reflection persistence.
 *   Reads from bug/execution stores; writes to reflection store only.
 * Exports: ReflectionEngine, reflectionEngine (singleton)
 */

import { bugStore }         from '../bug-memory/bug-store.ts';
import { executionStore }   from '../execution-memory/execution-store.ts';
import { reflectionStore }  from './reflection-store.ts';
import { lessonExtractor }  from './lesson-extractor.ts';
import type { ReflectionEntry } from '../types/entry.types.ts';

export interface ReflectionRunResult {
  processed:   number;
  created:     number;
  skipped:     number;
  durationMs:  number;
}

export class ReflectionEngine {

  /**
   * Run a full reflection pass.
   * Analyses recent bugs and failed executions, produces reflection entries.
   */
  async reflect(options: {
    maxBugs?:       number;
    maxExecutions?: number;
    minScore?:      number;
  } = {}): Promise<ReflectionRunResult> {
    const start    = Date.now();
    const minScore = options.minScore ?? 0.5;
    let created    = 0;
    let skipped    = 0;

    // ── Reflect on bugs ────────────────────────────────────────────────────
    const bugs = await bugStore.topRecurring(options.maxBugs ?? 20);
    for (const bug of bugs) {
      const alreadyReflected = (await reflectionStore.bySource(bug.id)).length > 0;
      if (alreadyReflected) { skipped++; continue; }

      const input = lessonExtractor.fromBug(bug);
      if (input.score! < minScore) { skipped++; continue; }

      await reflectionStore.record(input);
      created++;
    }

    // ── Reflect on failed executions ───────────────────────────────────────
    const failures = await executionStore.recentFailures(options.maxExecutions ?? 20);
    for (const exec of failures) {
      const alreadyReflected = (await reflectionStore.bySource(exec.id)).length > 0;
      if (alreadyReflected) { skipped++; continue; }

      const input = lessonExtractor.fromExecution(exec);
      if (input.score! < minScore) { skipped++; continue; }

      await reflectionStore.record(input);
      created++;
    }

    return {
      processed:  bugs.length + failures.length,
      created,
      skipped,
      durationMs: Date.now() - start,
    };
  }

  /** Return top unapplied improvements, ordered by score. */
  async pendingImprovements(limit = 10): Promise<ReflectionEntry[]> {
    return reflectionStore.unapplied().then(entries => entries.slice(0, limit));
  }

  /** Mark a reflection as applied after the team acts on it. */
  async markApplied(id: string): Promise<ReflectionEntry | undefined> {
    return reflectionStore.markApplied(id);
  }
}

export const reflectionEngine = new ReflectionEngine();
