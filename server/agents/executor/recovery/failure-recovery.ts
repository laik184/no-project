import { executorLogger } from '../telemetry/executor-logger.ts';
import { executorMetrics } from '../telemetry/executor-metrics.ts';

export type FailureCategory =
  | 'transient'
  | 'file_system'
  | 'command_error'
  | 'validation'
  | 'timeout'
  | 'fatal';

export interface RecoveryAction {
  action:   'retry' | 'skip' | 'rollback' | 'abort';
  reason:   string;
  delayMs?: number;
}

export function classifyError(error: unknown): FailureCategory {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
  if (msg.includes('enoent') || msg.includes('no such file') || msg.includes('eacces')) return 'file_system';
  if (msg.includes('blocked') || msg.includes('not allowed') || msg.includes('validation')) return 'validation';
  if (msg.includes('exit code') || msg.includes('spawn error') || msg.includes('command')) return 'command_error';
  if (msg.includes('econnreset') || msg.includes('socket') || msg.includes('network')) return 'transient';
  if (msg.includes('fatal') || msg.includes('out of memory') || msg.includes('sigkill')) return 'fatal';

  return 'transient';
}

export function suggestRecovery(
  category:   FailureCategory,
  attemptNum: number,
  maxAttempts = 3,
): RecoveryAction {
  if (category === 'fatal') {
    return { action: 'abort', reason: 'Fatal error — cannot recover' };
  }

  if (category === 'validation') {
    return { action: 'skip', reason: 'Validation failure — skipping task to avoid loops' };
  }

  if (attemptNum >= maxAttempts) {
    return { action: 'rollback', reason: `Max attempts (${maxAttempts}) exhausted` };
  }

  if (category === 'timeout' || category === 'transient') {
    return { action: 'retry', reason: `${category} error — retrying`, delayMs: 1_000 * attemptNum };
  }

  if (category === 'file_system') {
    return { action: 'retry', reason: 'File system error — retrying after delay', delayMs: 500 };
  }

  return { action: 'retry', reason: 'Unknown error — retrying', delayMs: 500 };
}

export const failureRecovery = {
  handle(
    runId:      string,
    taskId:     string,
    error:      unknown,
    attemptNum: number,
    maxAttempts = 3,
  ): RecoveryAction {
    const category = classifyError(error);
    const action   = suggestRecovery(category, attemptNum, maxAttempts);
    const msg      = error instanceof Error ? error.message : String(error);

    executorLogger.warn(runId, `Task ${taskId} failed (${category}) — action: ${action.action}`, {
      attempt: attemptNum, error: msg,
    });

    if (action.action !== 'retry') {
      executorMetrics.recordValidationFailure(runId);
    }

    return action;
  },
};
