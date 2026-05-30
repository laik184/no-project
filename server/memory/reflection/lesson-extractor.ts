/**
 * server/memory/reflection/lesson-extractor.ts
 *
 * Purpose: Extracts structured lessons from failure and execution memories.
 * Responsibility: Pattern-match content to identify mistakes and improvements.
 *   Does not write to any store — returns extracted lesson data only.
 * Exports: LessonExtractor, lessonExtractor (singleton)
 */

import type { BugEntry, ExecutionEntry } from '../types/entry.types.ts';
import type { CreateReflectionInput }    from './reflection-store.ts';

// ── Patterns ──────────────────────────────────────────────────────────────────

const FAILURE_PATTERNS: Array<{ pattern: RegExp; improvement: string }> = [
  {
    pattern:     /timeout|timed out/i,
    improvement: 'Implement retry logic with exponential backoff and explicit timeout budgets.',
  },
  {
    pattern:     /undefined|null|cannot read/i,
    improvement: 'Add null checks and type guards before property access.',
  },
  {
    pattern:     /permission|access denied|unauthorized/i,
    improvement: 'Validate permissions before execution; surface clear auth errors.',
  },
  {
    pattern:     /memory|heap|oom/i,
    improvement: 'Stream large payloads; limit batch sizes; profile heap usage.',
  },
  {
    pattern:     /syntax|parse error|invalid json/i,
    improvement: 'Validate and sanitize inputs before parsing; wrap parse calls in try/catch.',
  },
  {
    pattern:     /network|econnrefused|enotfound/i,
    improvement: 'Add network health checks; implement circuit breaker for external calls.',
  },
];

function matchImprovement(text: string): string {
  for (const { pattern, improvement } of FAILURE_PATTERNS) {
    if (pattern.test(text)) return improvement;
  }
  return 'Review error handling and add defensive checks in the affected module.';
}

// ── Extractor ─────────────────────────────────────────────────────────────────

export class LessonExtractor {

  fromBug(bug: BugEntry): CreateReflectionInput {
    return {
      sourceIds:   [bug.id],
      content:     `Bug reflection: ${bug.errorType} in ${bug.rootCause}`,
      tags:        ['bug', bug.errorType, ...bug.tags],
      score:       bug.recurrence > 3 ? 0.9 : 0.6,
      mistake:     `${bug.errorType}: ${bug.rootCause}`,
      lesson:      `Fix applied: ${bug.fix}`,
      improvement: matchImprovement(`${bug.rootCause} ${bug.content}`),
    };
  }

  fromExecution(exec: ExecutionEntry): CreateReflectionInput {
    const errorText = exec.errorSummary ?? exec.content;
    return {
      sourceIds:   [exec.id],
      content:     `Execution reflection: ${exec.goal} via ${exec.agentType}`,
      tags:        ['execution', exec.agentType, exec.success ? 'success' : 'failure'],
      score:       exec.success ? 0.4 : 0.8,
      mistake:     exec.success
        ? `Slow execution: ${exec.durationMs}ms for goal: ${exec.goal}`
        : `Failed execution: ${errorText}`,
      lesson:      exec.success
        ? `Goal "${exec.goal}" completed in ${exec.durationMs}ms via ${exec.agentType}.`
        : `Goal "${exec.goal}" failed via ${exec.agentType}: ${errorText}`,
      improvement: exec.success
        ? exec.durationMs > 30_000
          ? 'Break long-running goals into smaller sub-tasks.'
          : 'Execution is within acceptable bounds.'
        : matchImprovement(errorText),
    };
  }
}

export const lessonExtractor = new LessonExtractor();
