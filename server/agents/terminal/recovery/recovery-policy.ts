export type RecoveryAction = 'restart' | 'abort' | 'skip' | 'alert';

export interface RecoveryPolicy {
  maxRestarts:      number;
  backoffMs:        number;
  maxBackoffMs:     number;
  abortOnExceed:    boolean;
}

export const DEFAULT_POLICY: RecoveryPolicy = {
  maxRestarts:   3,
  backoffMs:     1_000,
  maxBackoffMs:  30_000,
  abortOnExceed: true,
};

export function getBackoffMs(attempt: number, policy: RecoveryPolicy): number {
  const backoff = policy.backoffMs * Math.pow(2, attempt - 1);
  return Math.min(backoff, policy.maxBackoffMs);
}

export function shouldRestart(
  attempt:    number,
  policy:     RecoveryPolicy,
): RecoveryAction {
  if (attempt > policy.maxRestarts) {
    return policy.abortOnExceed ? 'abort' : 'alert';
  }
  return 'restart';
}

export function evaluatePolicy(
  runId:    string,
  attempt:  number,
  policy    = DEFAULT_POLICY,
): { action: RecoveryAction; backoffMs: number } {
  const action    = shouldRestart(attempt, policy);
  const backoffMs = action === 'restart' ? getBackoffMs(attempt, policy) : 0;
  return { action, backoffMs };
}
