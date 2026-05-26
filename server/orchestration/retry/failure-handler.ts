import type { OrchestrationPhase } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';

export type FailureCategory =
  | 'timeout'
  | 'network'
  | 'llm'
  | 'build'
  | 'runtime'
  | 'validation'
  | 'unknown';

export interface ClassifiedFailure {
  category: FailureCategory;
  message: string;
  recoverable: boolean;
  recoveryAction?: string;
  originalError: string;
}

function classify(error: unknown): FailureCategory {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
  if (msg.includes('fetch') || msg.includes('econnreset') || msg.includes('network') || msg.includes('enotfound')) return 'network';
  if (msg.includes('openrouter') || msg.includes('openai') || msg.includes('llm') || msg.includes('completion')) return 'llm';
  if (msg.includes('build') || msg.includes('typescript') || msg.includes('compile')) return 'build';
  if (msg.includes('runtime') || msg.includes('crash') || msg.includes('exit')) return 'runtime';
  if (msg.includes('invalid') || msg.includes('validation') || msg.includes('schema')) return 'validation';
  return 'unknown';
}

function isRecoverable(category: FailureCategory): boolean {
  return category === 'timeout' || category === 'network' || category === 'llm' || category === 'runtime';
}

function recoveryAction(category: FailureCategory): string | undefined {
  const actions: Partial<Record<FailureCategory, string>> = {
    timeout: 'Increase timeout or reduce task scope',
    network: 'Retry with exponential backoff',
    llm: 'Retry LLM call with reduced prompt size',
    build: 'Attempt auto-fix of TypeScript errors',
    runtime: 'Restart runtime and re-verify',
  };
  return actions[category];
}

export const failureHandler = {
  classify(runId: string, phase: OrchestrationPhase, error: unknown): ClassifiedFailure {
    const category = classify(error);
    const originalError = error instanceof Error ? error.message : String(error);
    const recoverable = isRecoverable(category);
    const action = recoveryAction(category);

    const result: ClassifiedFailure = {
      category,
      message: `[${phase}] ${category} failure: ${originalError}`,
      recoverable,
      recoveryAction: action,
      originalError,
    };

    runLogger.log(runId, recoverable ? 'warn' : 'error', result.message, {
      category,
      recoverable,
      recoveryAction: action,
    });

    return result;
  },

  formatForReport(failure: ClassifiedFailure): string {
    const lines = [
      `Category: ${failure.category}`,
      `Recoverable: ${failure.recoverable}`,
      `Error: ${failure.originalError}`,
    ];
    if (failure.recoveryAction) lines.push(`Recovery: ${failure.recoveryAction}`);
    return lines.join('\n');
  },

  isRecoverable(failure: ClassifiedFailure): boolean {
    return failure.recoverable;
  },
};
