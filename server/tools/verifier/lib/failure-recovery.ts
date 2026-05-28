import type { VerificationPhase } from './verifier-types.ts';

export type RecoveryAction   = 'retry' | 'skip' | 'abort';

export interface RecoveryDecision {
  action:  RecoveryAction;
  reason:  string;
  retryIn: number;
}

const MAX_RETRIES = 2;
const retryCount  = new Map<string, number>();

const ABORTABLE_PATTERNS = [/network unreachable/i, /permission denied/i, /enospc/i];
const SKIPPABLE_PATTERNS = [/optional/i, /skip/i];

function shouldAbort(error: string, attempts: number): boolean {
  if (attempts >= MAX_RETRIES) return true;
  return ABORTABLE_PATTERNS.some((p) => p.test(error));
}

function shouldSkip(phase: VerificationPhase, error: string): boolean {
  if (phase === 'tests' && /no test files/i.test(error)) return true;
  return SKIPPABLE_PATTERNS.some((p) => p.test(error));
}

export function decideRecovery(runId: string, phase: VerificationPhase, error: string): RecoveryDecision {
  const key      = `${runId}:${phase}`;
  const attempts = (retryCount.get(key) ?? 0) + 1;
  retryCount.set(key, attempts);

  if (shouldSkip(phase, error)) {
    return { action: 'skip', reason: `Phase "${phase}" skipped: ${error}`, retryIn: 0 };
  }
  if (shouldAbort(error, attempts)) {
    return { action: 'abort', reason: `Aborting after ${attempts} attempt(s): ${error}`, retryIn: 0 };
  }
  const retryIn = Math.pow(2, attempts - 1) * 1_000;
  return { action: 'retry', reason: `Attempt ${attempts}/${MAX_RETRIES}: ${error}`, retryIn };
}

export function clearRecoveryState(runId: string): void {
  for (const key of retryCount.keys()) {
    if (key.startsWith(`${runId}:`)) retryCount.delete(key);
  }
}
