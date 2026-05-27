export type RecoveryAction = 'retry' | 'skip' | 'abort';

export interface RecoveryDecision {
  action:  RecoveryAction;
  reason:  string;
}

const failureCounts = new Map<string, Map<string, number>>();

function getCount(runId: string, taskId: string): number {
  return failureCounts.get(runId)?.get(taskId) ?? 0;
}

function increment(runId: string, taskId: string): number {
  if (!failureCounts.has(runId)) failureCounts.set(runId, new Map());
  const m   = failureCounts.get(runId)!;
  const val = (m.get(taskId) ?? 0) + 1;
  m.set(taskId, val);
  return val;
}

export const failureRecovery = {
  handle(
    runId:   string,
    taskId:  string,
    _error:  string,
    attempt: number,
  ): RecoveryDecision {
    const count = increment(runId, taskId);

    if (count >= 3) {
      return { action: 'abort', reason: `Task ${taskId} failed ${count} times — aborting` };
    }

    if (attempt >= 2) {
      return { action: 'skip', reason: `Skipping step after ${attempt} failed attempts` };
    }

    return { action: 'retry', reason: `Retry attempt ${count}` };
  },

  clear(runId: string): void {
    failureCounts.delete(runId);
  },
};
