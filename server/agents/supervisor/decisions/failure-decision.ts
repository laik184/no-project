import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { SupervisorDecision, ExecutionMode } from '../types/supervisor.types.ts';

type FailureCategory = 'network' | 'timeout' | 'build' | 'llm' | 'validation' | 'unknown';

interface FailureContext {
  phase: OrchestrationPhase;
  error: string;
  retryCount: number;
  mode: ExecutionMode;
  durationMs: number;
}

const OPTIONAL_PHASES: OrchestrationPhase[] = ['browser'];
const TIMEOUT_THRESHOLD_MS = 90_000;

function categorizeError(error: string): FailureCategory {
  const e = error.toLowerCase();
  if (e.includes('network') || e.includes('econnrefused') || e.includes('enotfound')) return 'network';
  if (e.includes('timeout') || e.includes('timed out')) return 'timeout';
  if (e.includes('tsc') || e.includes('build') || e.includes('compile')) return 'build';
  if (e.includes('llm') || e.includes('openrouter') || e.includes('openai') || e.includes('model')) return 'llm';
  if (e.includes('zod') || e.includes('validation') || e.includes('invalid')) return 'validation';
  return 'unknown';
}

function isRecoverable(category: FailureCategory, retryCount: number): boolean {
  if (retryCount > 3) return false;
  switch (category) {
    case 'network':    return true;
    case 'timeout':    return true;
    case 'llm':        return retryCount < 2;
    case 'build':      return false;
    case 'validation': return false;
    case 'unknown':    return retryCount < 1;
  }
}

export const failureDecision = {
  decide(ctx: FailureContext): SupervisorDecision & { category: FailureCategory; recoverable: boolean } {
    const category = categorizeError(ctx.error);
    const recoverable = isRecoverable(category, ctx.retryCount);

    if (OPTIONAL_PHASES.includes(ctx.phase)) {
      return {
        action:     'skip',
        reason:     `Optional phase "${ctx.phase}" failed — skipping (${category})`,
        metadata:   { category, phase: ctx.phase },
        category,
        recoverable: true,
      };
    }

    if (recoverable) {
      return {
        action:     'retry',
        reason:     `Recoverable ${category} error on phase "${ctx.phase}" — retrying`,
        metadata:   { category, phase: ctx.phase, retryCount: ctx.retryCount },
        category,
        recoverable,
      };
    }

    return {
      action:     'abort',
      reason:     `Non-recoverable ${category} failure on phase "${ctx.phase}": ${ctx.error}`,
      metadata:   { category, phase: ctx.phase, durationMs: ctx.durationMs },
      category,
      recoverable: false,
    };
  },

  categorize(error: string): FailureCategory {
    return categorizeError(error);
  },

  isOptionalPhase(phase: OrchestrationPhase): boolean {
    return OPTIONAL_PHASES.includes(phase);
  },
};
