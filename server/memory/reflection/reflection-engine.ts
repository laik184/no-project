/**
 * server/memory/reflection/reflection-engine.ts
 *
 * Purpose: Drives the reflection process by consuming bug and execution memories.
 * Responsibility: Orchestrates lesson extraction + reflection persistence.
 *   Reads from bug/execution stores; writes to reflection store only.
 *   Two-pass strategy:
 *     Pass 1 — domain-typed entries via topRecurring / recentFailures
 *     Pass 2 — generic entries written by agents via tag-based list() fallback
 * Exports: ReflectionEngine, reflectionEngine (singleton)
 */

import { bugStore }         from '../bug-memory/bug-store.ts';
import { executionStore }   from '../execution-memory/execution-store.ts';
import { reflectionStore }  from './reflection-store.ts';
import { lessonExtractor }  from './lesson-extractor.ts';
import type { BugEntry, ExecutionEntry } from '../types/entry.types.ts';
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
   * Two passes: domain-typed (Pass 1) + tag-based fallback (Pass 2).
   */
  async reflect(options: {
    maxBugs?:       number;
    maxExecutions?: number;
    minScore?:      number;
  } = {}): Promise<ReflectionRunResult> {
    const start    = Date.now();
    const minScore = options.minScore ?? 0.5;
    const maxBugs  = options.maxBugs ?? 20;
    const maxExec  = options.maxExecutions ?? 20;
    let created    = 0;
    let skipped    = 0;
    let processed  = 0;

    // ── Pass 1: Domain-typed bugs (topRecurring — requires typed recurrence) ──
    const typedBugs = await bugStore.topRecurring(maxBugs);
    for (const bug of typedBugs) {
      processed++;
      const alreadyReflected = (await reflectionStore.bySource(bug.id)).length > 0;
      if (alreadyReflected) { skipped++; continue; }
      const input = lessonExtractor.fromBug(bug);
      if ((input.score ?? 0) < minScore) { skipped++; continue; }
      await reflectionStore.record(input);
      created++;
    }

    // ── Pass 1B: Tag-based fallback for generic bug entries ───────────────────
    const typedBugIds = new Set(typedBugs.map(b => b.id));
    const genericBugs = await bugStore.list({ tags: ['failure'], limit: maxBugs });
    for (const entry of genericBugs) {
      if (typedBugIds.has(entry.id)) continue; // already handled above
      processed++;
      const alreadyReflected = (await reflectionStore.bySource(entry.id)).length > 0;
      if (alreadyReflected) { skipped++; continue; }
      // Build a minimal BugEntry-compatible reflection from the generic entry
      const syntheticBug: BugEntry = {
        ...entry,
        errorType:  (entry.meta?.errorType as string) ?? 'UnknownError',
        rootCause:  (entry.meta?.errorSnippet as string) ?? entry.content.slice(0, 100),
        fix:        (entry.meta?.fixApplied as string) ?? 'pending',
        recurrence: typeof entry.meta?.occurrences === 'number' ? entry.meta.occurrences : 1,
        resolved:   false,
      };
      const input = lessonExtractor.fromBug(syntheticBug);
      if ((input.score ?? 0) < minScore) { skipped++; continue; }
      await reflectionStore.record(input);
      created++;
    }

    // ── Pass 2: Domain-typed failed executions ────────────────────────────────
    const typedFailures = await executionStore.recentFailures(maxExec);
    // recentFailures() filters !e.success — only entries with typed success=false
    // (entries written via generic create() have success=undefined which also passes
    //  !undefined — handled in Pass 2B instead)
    const typedExecIds = new Set<string>();
    for (const exec of typedFailures) {
      if (exec.success !== false) continue; // skip generic entries (success===undefined) here
      typedExecIds.add(exec.id);
      processed++;
      const alreadyReflected = (await reflectionStore.bySource(exec.id)).length > 0;
      if (alreadyReflected) { skipped++; continue; }
      const input = lessonExtractor.fromExecution(exec);
      if ((input.score ?? 0) < minScore) { skipped++; continue; }
      await reflectionStore.record(input);
      created++;
    }

    // ── Pass 2B: Tag-based fallback for generic execution failure entries ─────
    const genericExecFailures = await executionStore.list({ tags: ['failure'], limit: maxExec });
    for (const entry of genericExecFailures) {
      if (typedExecIds.has(entry.id)) continue; // already handled above
      processed++;
      const alreadyReflected = (await reflectionStore.bySource(entry.id)).length > 0;
      if (alreadyReflected) { skipped++; continue; }
      const syntheticExec: ExecutionEntry = {
        ...entry,
        runId:        (entry.meta?.runId as string)       ?? '',
        goal:         (entry.meta?.goal as string)        ?? entry.content.slice(0, 80),
        agentType:    (entry.meta?.agentSource as string) ?? 'unknown',
        toolsUsed:    [],
        durationMs:   typeof entry.meta?.durationMs === 'number' ? entry.meta.durationMs : 0,
        success:      false,
        errorSummary: entry.content.slice(0, 200),
      };
      const input = lessonExtractor.fromExecution(syntheticExec);
      if ((input.score ?? 0) < minScore) { skipped++; continue; }
      await reflectionStore.record(input);
      created++;
    }

    return { processed, created, skipped, durationMs: Date.now() - start };
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
