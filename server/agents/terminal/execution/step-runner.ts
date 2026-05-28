/**
 * server/agents/terminal/execution/step-runner.ts
 *
 * Executes ONE execution step at a time by routing it through the
 * tool-coordinator → dispatcher-client → central tool dispatcher.
 *
 * No direct tool implementations. No shell calls. No child_process.
 * Pure orchestration: converts ExecutionStep → tool call → StepOutcome.
 */

import type { ExecutionStep, StepOutcome }  from '../types/terminal.types.ts';
import type { TerminalExecutionContext }     from '../core/terminal-context.ts';
import { routeStep }                         from '../coordination/execution-routing.ts';
import { withRetry, policyForStepType }      from './retry-manager.ts';
import { terminalLogger }                    from '../telemetry/terminal-logger.ts';
import { terminalMetrics }                   from '../telemetry/terminal-metrics.ts';
import { elapsedMs }                         from '../utils/execution-utils.ts';

// ── Public interface ──────────────────────────────────────────────────────────

export async function runStep(
  step:    ExecutionStep,
  context: TerminalExecutionContext,
): Promise<StepOutcome> {
  const startedAt = new Date();
  const policy    = policyForStepType(step.type);

  terminalLogger.step(context.runId, step.id, 'start', { type: step.type, label: step.label });

  const retryResult = await withRetry(
    () => routeStep(step, context.toolCtx),
    { runId: context.runId, stepId: step.id, policy },
    (r) => r.success,
  );

  const durationMs = elapsedMs(startedAt);
  const attempt    = retryResult.attempts;

  let outcome: StepOutcome;

  if (retryResult.success && retryResult.value) {
    const r = retryResult.value;
    outcome = {
      stepId: step.id,
      success: true,
      durationMs,
      attempt,
      output:   r.success ? r.output : undefined,
      filePath: r.success ? r.filePath : undefined,
    };
  } else {
    outcome = {
      stepId:  step.id,
      success: false,
      durationMs,
      attempt,
      error:   retryResult.lastError ?? 'Step failed',
    };
  }

  terminalMetrics.recordStep(context.runId, outcome.success, durationMs);
  terminalLogger.step(context.runId, step.id, outcome.success ? 'complete' : 'fail', {
    durationMs, attempt, error: outcome.error,
  });

  return outcome;
}
