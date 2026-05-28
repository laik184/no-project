/**
 * recovery/failure-recovery.ts
 * Determines recovery action for a given failure.
 * Called by server/tools/verifier/recovery/failure-recovery.ts.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';

export type RecoveryAction = 'retry' | 'rollback' | 'skip' | 'abort';

export interface RecoveryDecision {
  action:      RecoveryAction;
  reason:      string;
  canRetry:    boolean;
  maxRetries:  number;
  retryIn?:    number;
}

const RETRY_PHASES: VerificationPhase[] = ['runtime', 'endpoints'];
const ABORT_PHASES: VerificationPhase[] = ['typecheck'];

const recoveryAttempts = new Map<string, number>();

function runKey(runId: string, phase: VerificationPhase): string {
  return `${runId}:${phase}`;
}

export function decideRecovery(
  runId:  string,
  phase:  VerificationPhase,
  error:  string,
): RecoveryDecision {
  const key      = runKey(runId, phase);
  const attempts = recoveryAttempts.get(key) ?? 0;

  if (ABORT_PHASES.includes(phase)) {
    return { action: 'abort', reason: 'Non-retryable phase failure', canRetry: false, maxRetries: 0 };
  }

  if (error.includes('permission') || error.includes('EACCES')) {
    return { action: 'abort', reason: 'Permission error', canRetry: false, maxRetries: 0 };
  }

  if (RETRY_PHASES.includes(phase) && attempts < 2) {
    recoveryAttempts.set(key, attempts + 1);
    return { action: 'retry', reason: 'Transient failure — retrying', canRetry: true, maxRetries: 2, retryIn: 1_000 };
  }

  if (attempts >= 2) {
    return { action: 'rollback', reason: 'Retry exhausted — rolling back', canRetry: false, maxRetries: 2 };
  }

  return { action: 'skip', reason: 'Non-critical phase skipped', canRetry: false, maxRetries: 0 };
}

export function clearRecoveryState(runId: string): void {
  for (const key of recoveryAttempts.keys()) {
    if (key.startsWith(`${runId}:`)) recoveryAttempts.delete(key);
  }
}
