export type RecoveryAction = 'retry' | 'skip' | 'abort';

export interface RecoveryDecision {
  action:  RecoveryAction;
  reason?: string;
}

const MAX_RETRIES = 2;
const failureCounts = new Map<string, number>();

export const failureRecovery = {
  handle(
    runId:   string,
    taskId:  string,
    error:   string,
    attempt: number,
  ): RecoveryDecision {
    const key   = `${runId}:${taskId}`;
    const count = (failureCounts.get(key) ?? 0) + 1;
    failureCounts.set(key, count);

    if (count <= MAX_RETRIES) return { action: 'retry', reason: `Attempt ${count}` };

    if (/timeout|ETIMEDOUT/i.test(error)) return { action: 'skip', reason: 'Timeout — skipping step' };
    if (/not found|ENOENT/i.test(error))  return { action: 'skip', reason: 'File not found — skipping step' };

    return { action: 'abort', reason: `Max retries (${MAX_RETRIES}) exceeded` };
  },

  clear(runId: string): void {
    for (const key of failureCounts.keys()) {
      if (key.startsWith(`${runId}:`)) failureCounts.delete(key);
    }
  },
};
