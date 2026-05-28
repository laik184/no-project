/**
 * server/agents/supervisor/execution/task-runner.ts
 *
 * Executes a single supervision task through the coordination layer.
 * Handles retry policy selection, outcome assembly, and timing.
 * Pure orchestration — routes to agent-coordinator, never executes directly.
 */

import type { SupervisionTask, TaskOutcome } from '../types/supervisor.types.ts';
import type { SupervisionContext }            from '../core/supervisor-context.ts';
import { routeTask }                          from '../coordination/supervision-routing.ts';
import { policyForDomain, withRetry }         from './retry-manager.ts';
import { supervisorLogger }                   from '../telemetry/supervisor-logger.ts';

// ── Task runner ───────────────────────────────────────────────────────────────

export async function runTask(
  task:    SupervisionTask,
  context: SupervisionContext,
): Promise<TaskOutcome> {
  const { id: taskId, domain, retryLimit, label } = task;
  const { runId } = context;

  const basePolicy  = policyForDomain(domain);
  const policy      = { ...basePolicy, maxAttempts: Math.max(retryLimit, 1) };
  const startedAt   = Date.now();

  supervisorLogger.task(runId, taskId, 'start', { domain, label });

  const retryResult = await withRetry(
    async () => {
      const routed = await routeTask(task, context);
      return routed;
    },
    { runId, taskId, domain, policy },
    (r) => r.success,
  );

  const durationMs = Date.now() - startedAt;

  if (retryResult.success && retryResult.value) {
    const routed = retryResult.value;
    const output = 'output' in routed ? String(routed.output ?? '') : '';

    supervisorLogger.task(runId, taskId, 'complete', { durationMs, domain });
    return {
      taskId,
      domain,
      success:    true,
      durationMs,
      output,
      attempt:    retryResult.attempts,
    };
  }

  const error = retryResult.lastError ?? 'Task failed without error message';
  supervisorLogger.task(runId, taskId, 'failed', { error, durationMs, domain });

  return {
    taskId,
    domain,
    success:    false,
    durationMs,
    error,
    attempt:    retryResult.attempts,
  };
}
