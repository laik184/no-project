/**
 * server/agents/terminal/execution/execution-loop.ts
 *
 * THE HEART of the terminal agent.
 *
 * Controls the execution loop:
 *   - chooses the next step
 *   - dispatches via step-runner → coordination → dispatcher → tools
 *   - manages retries, recovery, and health checks
 *   - drives the session to completion or controlled failure
 *
 * Architecture: orchestration ONLY.
 * No child_process. No spawn. No exec. No shell. No direct tool calls.
 */

import type { ExecutionStep, StepOutcome, RecoveryAction } from '../types/terminal.types.ts';
import type { TerminalExecutionContext }                    from '../core/terminal-context.ts';
import { terminalState }                                   from '../core/terminal-state.ts';
import { terminalSession }                                 from '../core/terminal-session.ts';
import { runtimeMonitor }                                  from '../monitoring/runtime-health-monitor.ts';
import { failureMonitor }                                  from '../monitoring/failure-monitor.ts';
import { terminalLogger }                                  from '../telemetry/terminal-logger.ts';
import { runStep }                                         from './step-runner.ts';
import { decideRecovery }                                  from '../utils/execution-utils.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CONSECUTIVE_FAILURES = 5;
const HEALTH_FAILURE_RATE_ABORT = 0.8;

// ── Execution loop ────────────────────────────────────────────────────────────

export async function runExecutionLoop(
  steps:   readonly ExecutionStep[],
  context: TerminalExecutionContext,
): Promise<StepOutcome[]> {
  const { runId } = context;
  const outcomes: StepOutcome[] = [];
  let consecutiveFailures = 0;

  terminalLogger.info(runId, `Execution loop starting — ${steps.length} step(s)`);
  terminalSession.transition(runId, 'executing');

  for (const step of steps) {
    // ── Abort guard: crash loop detection ──────────────────────────────────
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      terminalLogger.error(runId, `Aborting: ${consecutiveFailures} consecutive failures`);
      terminalSession.transition(runId, 'failed');
      terminalState.setStatus(runId, 'failed');
      break;
    }

    // ── Abort guard: overall health check ──────────────────────────────────
    if (!runtimeMonitor.isHealthy(runId)) {
      terminalLogger.warn(runId, 'Runtime health degraded — checking failure rate');
      const failRate = terminalState.failureRate(runId);
      if (failRate >= HEALTH_FAILURE_RATE_ABORT) {
        terminalLogger.error(runId, `Aborting: failure rate ${(failRate * 100).toFixed(0)}% exceeds threshold`);
        terminalSession.transition(runId, 'failed');
        terminalState.setStatus(runId, 'failed');
        break;
      }
    }

    // ── Abort guard: crash-loop detection ──────────────────────────────────
    if (failureMonitor.isCrashLooping(runId)) {
      terminalLogger.error(runId, 'Crash loop detected — aborting execution');
      terminalSession.transition(runId, 'failed');
      terminalState.setStatus(runId, 'failed');
      break;
    }

    // ── Route this step ────────────────────────────────────────────────────
    terminalSession.transition(runId, 'executing');
    const outcome = await runStep(step, context);
    outcomes.push(outcome);

    // ── Update state ───────────────────────────────────────────────────────
    terminalState.recordOutcome(runId, outcome);
    runtimeMonitor.recordStep(runId, outcome.success);

    if (outcome.success) {
      consecutiveFailures = 0;
      terminalLogger.step(runId, step.id, 'ok', { durationMs: outcome.durationMs, attempt: outcome.attempt });
    } else {
      consecutiveFailures++;
      const action = decideRecoveryAction(outcome.error ?? '', step.retryLimit, outcome.attempt);
      terminalLogger.warn(runId, `Step ${step.id} failed — action=${action}`, { error: outcome.error, consecutiveFailures });

      if (action === 'abort') {
        terminalSession.transition(runId, 'failed');
        terminalState.setStatus(runId, 'failed');
        break;
      }
      if (action === 'skip') {
        terminalLogger.warn(runId, `Skipping step ${step.id}`);
        continue;
      }
      // 'retry' — retry-manager inside runStep already handled this
    }
  }

  terminalSession.transition(runId, 'completing');
  terminalLogger.info(runId, `Execution loop complete — ${outcomes.length} step(s) run`);
  return outcomes;
}

// ── Recovery decision ─────────────────────────────────────────────────────────

function decideRecoveryAction(
  error:      string,
  retryLimit: number,
  attempts:   number,
): RecoveryAction {
  if (attempts >= retryLimit) return 'abort';
  return decideRecovery(error);
}
