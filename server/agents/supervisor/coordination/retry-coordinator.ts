import { retryManager } from '../../../orchestration/retry/retry-manager.ts';
import { retryDecision } from '../decisions/retry-decision.ts';
import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode, SupervisorDecision } from '../types/supervisor.types.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import { sleep } from '../../../orchestration/utils/execution-utils.ts';

export interface RetryCoordinatorOptions {
  phase: OrchestrationPhase;
  runId: string;
  taskId: string;
  mode: ExecutionMode;
}

export const retryCoordinator = {
  async executeWithRetry<T>(
    opts: RetryCoordinatorOptions,
    fn: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; decision: SupervisorDecision; error: string }> {
    const { phase, runId, taskId, mode } = opts;
    const maxAttempts = retryDecision.maxRetries(phase, mode);

    try {
      const value = await retryManager.withRetry(
        taskId,
        runId,
        fn,
        {
          maxAttempts,
          backoff: { baseDelayMs: 1_000, maxDelayMs: 30_000, jitter: true },
          onRetry: (attempt, delay, err) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            supervisorLogger.warn(
              runId,
              `[retry-coordinator] Phase "${phase}" retry ${attempt}/${maxAttempts} in ${delay}ms — ${errMsg}`,
            );
          },
        },
      );
      retryManager.clearRecord(taskId);
      return { ok: true, value };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const retries = retryManager.getRecord(taskId)?.attempts ?? maxAttempts;
      const decision = retryDecision.shouldRetry(phase, errMsg, retries, mode);
      retryManager.clearRecord(taskId);
      return { ok: false, decision, error: errMsg };
    }
  },

  isExhausted(taskId: string): boolean {
    return retryManager.isExhausted(taskId);
  },

  async waitBeforeRetry(attempt: number): Promise<void> {
    const delay = retryDecision.retryDelay(attempt);
    await sleep(delay);
  },

  clearTask(taskId: string): void {
    retryManager.clearRecord(taskId);
  },
};
