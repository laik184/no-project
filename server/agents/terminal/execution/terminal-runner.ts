/**
 * server/agents/terminal/execution/terminal-runner.ts
 *
 * Orchestrates running a sequence of steps through the execution loop.
 * Manages session lifecycle: open → loop → close.
 * Pure orchestration — no direct tool execution.
 */

import type { ExecutionStep, StepOutcome, SessionStatus } from '../types/terminal.types.ts';
import type { TerminalExecutionContext }                   from '../core/terminal-context.ts';
import { terminalSession }                                from '../core/terminal-session.ts';
import { terminalState }                                  from '../core/terminal-state.ts';
import { runExecutionLoop }                               from './execution-loop.ts';
import { terminalLogger }                                 from '../telemetry/terminal-logger.ts';
import { terminalMetrics }                                from '../telemetry/terminal-metrics.ts';
import { elapsedMs }                                      from '../utils/execution-utils.ts';

export interface RunnerInput {
  steps:   readonly ExecutionStep[];
  context: TerminalExecutionContext;
}

export interface RunnerResult {
  runId:      string;
  success:    boolean;
  durationMs: number;
  outcomes:   StepOutcome[];
  status:     SessionStatus;
}

export async function runTerminal(input: RunnerInput): Promise<RunnerResult> {
  const { steps, context } = input;
  const { runId, projectId, sandboxRoot } = context;
  const startedAt = new Date();

  terminalSession.open({ runId, projectId, sandboxRoot, totalSteps: steps.length });
  terminalSession.transition(runId, 'validating');

  if (steps.length === 0) {
    terminalLogger.warn(runId, 'No steps to execute');
    terminalSession.close(runId, true, 0);
    return { runId, success: true, durationMs: 0, outcomes: [], status: 'completed' };
  }

  terminalSession.transition(runId, 'executing');

  let outcomes: StepOutcome[];
  let success: boolean;

  try {
    outcomes = await runExecutionLoop(steps, context);
    const state = terminalState.get(runId);
    success = state ? state.failedSteps === 0 || (state.completedSteps > 0 && state.outcomes.some((o) => o.success)) : false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    terminalLogger.error(runId, `Execution loop crashed: ${msg}`);
    success  = false;
    outcomes = [];
  }

  const durationMs = elapsedMs(startedAt);
  terminalSession.close(runId, success, durationMs);

  const finalStatus: SessionStatus = success ? 'completed' : 'failed';
  const metrics = terminalMetrics.snapshot(runId);
  terminalLogger.info(runId, `Run finished — success=${success}`, {
    durationMs, totalSteps: steps.length,
    successRate: metrics ? (metrics.stepsOk / Math.max(metrics.stepsTotal, 1)).toFixed(2) : 'n/a',
  });

  terminalSession.release(runId);
  return { runId, success, durationMs, outcomes, status: finalStatus };
}
