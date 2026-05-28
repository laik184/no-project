/**
 * server/agents/terminal/execution/execution-loop.ts
 *
 * THE HEART of the terminal agent.
 * Controls the execution loop: chooses next step, manages retries,
 * updates execution state, and drives the session to completion.
 *
 * Architecture: orchestration only — no direct tool calls.
 */

import type { ExecutionStep, StepOutcome } from '../types/terminal.types.ts';
import type { TerminalExecutionContext }    from '../core/terminal-context.ts';
import { routeStep }                        from '../coordination/execution-routing.ts';
import { coordinateCommand }                from '../coordination/tool-coordinator.ts';
import { withRetry }                        from './retry-manager.ts';
import { terminalLogger }                   from '../telemetry/terminal-logger.ts';
import { terminalMetrics }                  from '../telemetry/terminal-metrics.ts';
import { runtimeMonitor }                   from '../monitoring/runtime-monitor.ts';
import { failureMonitor }                   from '../monitoring/failure-monitor.ts';
import { classifyError, elapsedMs }         from '../utils/execution-utils.ts';
import { terminalState }                    from '../core/terminal-state.ts';

export interface LoopResult {
  readonly runId:          string;
  readonly stepsTotal:     number;
  readonly stepsSucceeded: number;
  readonly stepsFailed:    number;
  readonly durationMs:     number;
  readonly ok:             boolean;
}

export async function runExecutionLoop(
  steps:   readonly ExecutionStep[],
  ctx:     TerminalExecutionContext,
): Promise<LoopResult> {
  const start         = Date.now();
  let stepsSucceeded  = 0;
  let stepsFailed     = 0;

  terminalState.setStatus(ctx.runId, 'running');
  terminalLogger.info(ctx.runId, `Execution loop started — ${steps.length} steps`);

  for (const step of steps) {
    if (!runtimeMonitor.isHealthy(ctx.runId)) {
      terminalLogger.warn(ctx.runId, `Execution loop halted — unhealthy session`, {
        failures: failureMonitor.summary(ctx.runId),
      });
      break;
    }

    const outcome = await executeStep(step, ctx);
    terminalMetrics.recordStep(ctx.runId, outcome.success, outcome.durationMs, outcome.attempts - 1);
    runtimeMonitor.recordStep(ctx.runId, outcome.success);

    if (outcome.success) {
      stepsSucceeded++;
      terminalState.recordCompleted(ctx.runId);
    } else {
      stepsFailed++;
      terminalState.recordFailed(ctx.runId);

      const action = classifyError(outcome.error ?? '');
      if (action === 'abort') {
        terminalLogger.error(ctx.runId, `Aborting loop on unrecoverable step failure`, {
          stepId: step.id,
          error:  outcome.error,
        });
        break;
      }
    }
  }

  const ok = stepsFailed === 0 || stepsSucceeded > stepsFailed;
  terminalState.setStatus(ctx.runId, ok ? 'completed' : 'failed');
  terminalLogger.info(ctx.runId, `Execution loop done`, {
    stepsSucceeded,
    stepsFailed,
    durationMs: elapsedMs(start),
    ok,
  });

  return {
    runId:          ctx.runId,
    stepsTotal:     steps.length,
    stepsSucceeded,
    stepsFailed,
    durationMs:     elapsedMs(start),
    ok,
  };
}

async function executeStep(
  step: ExecutionStep,
  ctx:  TerminalExecutionContext,
): Promise<StepOutcome> {
  const start    = Date.now();
  const decision = routeStep(step);

  if (!decision) {
    terminalLogger.warn(ctx.runId, `No tool route for step type "${step.type}" — skipping`, { stepId: step.id });
    return { stepId: step.id, success: true, output: `Skipped: ${step.type}`, durationMs: elapsedMs(start), attempts: 1 };
  }

  try {
    const { result: response, attempts } = await withRetry(
      () => coordinateCommand(ctx.runId, ctx.projectId, ctx.sandboxRoot, decision),
      ctx.runId,
      step.id,
      step.retryPolicy,
    );

    const success = response.ok;
    return {
      stepId:     step.id,
      success,
      output:     success ? String(response.data ?? '') : undefined,
      error:      success ? undefined : response.error,
      durationMs: elapsedMs(start),
      attempts,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { stepId: step.id, success: false, error, durationMs: elapsedMs(start), attempts: step.retryPolicy.maxAttempts };
  }
}
