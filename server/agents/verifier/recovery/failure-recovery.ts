import type { VerificationPhase } from '../types/verifier.types.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export type RecoveryAction = 'retry' | 'skip' | 'abort' | 'partial';

export interface RecoveryDecision {
  action:  RecoveryAction;
  reason:  string;
  retryIn?: number;
}

const RECOVERABLE_PHASES = new Set<VerificationPhase>(['runtime', 'endpoints', 'tests']);
const MAX_FAILURES_MAP: Partial<Record<VerificationPhase, number>> = {
  typecheck: 1,
  build:     1,
  runtime:   2,
  endpoints: 2,
  tests:     1,
};

const failureCounts = new Map<string, Map<VerificationPhase, number>>();

function getFailureCount(runId: string, phase: VerificationPhase): number {
  return failureCounts.get(runId)?.get(phase) ?? 0;
}

function incrementFailure(runId: string, phase: VerificationPhase): number {
  if (!failureCounts.has(runId)) failureCounts.set(runId, new Map());
  const counts = failureCounts.get(runId)!;
  const next   = (counts.get(phase) ?? 0) + 1;
  counts.set(phase, next);
  return next;
}

export function decideRecovery(
  runId:  string,
  phase:  VerificationPhase,
  error:  string,
): RecoveryDecision {
  const count   = incrementFailure(runId, phase);
  const maxFail = MAX_FAILURES_MAP[phase] ?? 1;

  if (!RECOVERABLE_PHASES.has(phase)) {
    verifierLogger.warn(runId, `[recovery] Phase "${phase}" is not recoverable — aborting`);
    return { action: 'abort', reason: `Phase ${phase} does not support recovery` };
  }

  if (count >= maxFail) {
    verifierLogger.warn(runId, `[recovery] Phase "${phase}" exceeded max failures (${maxFail})`);
    return { action: 'skip', reason: `Max failures reached for phase ${phase}` };
  }

  verifierLogger.info(runId, `[recovery] Retrying phase "${phase}" (attempt ${count})`);
  return { action: 'retry', reason: `Attempt ${count}`, retryIn: 1000 * count };
}

export function clearRecoveryState(runId: string): void {
  failureCounts.delete(runId);
}
