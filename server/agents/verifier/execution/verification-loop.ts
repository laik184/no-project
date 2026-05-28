/**
 * server/agents/verifier/execution/verification-loop.ts
 *
 * THE HEART of the verifier agent.
 *
 * Controls the verification loop:
 *   - selects the next step to execute
 *   - dispatches via step-runner → routing → coordinator → dispatcher → tools
 *   - manages health checks and crash-loop detection
 *   - drives the session to completion or controlled failure
 *
 * Architecture: orchestration ONLY. No spawn, exec, shell, fetch, or direct tool calls.
 */

import type { VerificationStep, VerificationStepResult } from '../types/verifier.types.ts';
import type { VerifierExecutionContext }                   from '../core/verifier-context.ts';
import { verifierState }                                  from '../core/verifier-state.ts';
import { verifierSession }                                from '../core/verifier-session.ts';
import { verifierHealthMonitor }                          from '../monitoring/health-monitor.ts';
import { failureMonitor }                                 from '../monitoring/failure-monitor.ts';
import { verifierLogger }                                 from '../telemetry/verifier-logger.ts';
import { runVerificationStep }                            from './step-runner.ts';

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_CONSECUTIVE_FAILURES    = 4;
const HEALTH_FAILURE_RATE_ABORT   = 0.8;

// ── Verification loop ─────────────────────────────────────────────────────────

export async function runVerificationLoop(
  steps:   readonly VerificationStep[],
  context: VerifierExecutionContext,
): Promise<VerificationStepResult[]> {
  const { runId } = context;
  const outcomes: VerificationStepResult[] = [];
  let consecutiveFailures = 0;

  verifierLogger.info(runId, `Verification loop starting — ${steps.length} step(s)`);
  verifierSession.transition(runId, 'executing');
  verifierHealthMonitor.onRunStart(runId);

  for (const step of steps) {
    // ── Abort guard: consecutive failure limit ─────────────────────────────
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      verifierLogger.error(runId, `Aborting: ${consecutiveFailures} consecutive failures`);
      verifierSession.transition(runId, 'failed');
      verifierState.setStatus(runId, 'failed');
      break;
    }

    // ── Abort guard: failure rate threshold ───────────────────────────────
    const failRate = verifierState.failureRate(runId);
    if (failRate >= HEALTH_FAILURE_RATE_ABORT && outcomes.length > 2) {
      verifierLogger.error(runId, `Aborting: failure rate ${(failRate * 100).toFixed(0)}% exceeds threshold`);
      verifierSession.transition(runId, 'failed');
      verifierState.setStatus(runId, 'failed');
      break;
    }

    // ── Abort guard: crash-loop detection ─────────────────────────────────
    if (failureMonitor.isCrashLooping(runId)) {
      verifierLogger.error(runId, 'Crash loop detected — aborting verification');
      verifierSession.transition(runId, 'failed');
      verifierState.setStatus(runId, 'failed');
      break;
    }

    // ── Execute this step ─────────────────────────────────────────────────
    verifierSession.setPhase(runId, step.phase);
    verifierHealthMonitor.onPhaseChange(runId, step.phase);

    const outcome = await runVerificationStep(step, context.toolCtx);
    outcomes.push(outcome);
    verifierState.recordResult(runId, outcome);

    if (outcome.success) {
      consecutiveFailures = 0;
      verifierLogger.phase(runId, step.phase, 'pass', { durationMs: outcome.durationMs, attempt: outcome.attempt });
    } else {
      consecutiveFailures++;
      verifierLogger.phase(runId, step.phase, step.critical ? 'fail' : 'skip', { error: outcome.error, consecutiveFailures });

      // Critical failures abort the pipeline; non-critical continue
      if (step.critical) {
        verifierSession.transition(runId, 'failed');
        verifierState.setStatus(runId, 'failed');
        break;
      }
    }
  }

  verifierSession.transition(runId, 'completing');
  verifierHealthMonitor.onRunComplete(runId, consecutiveFailures === 0);
  verifierLogger.info(runId, `Verification loop complete — ${outcomes.length} step(s) run`);
  return outcomes;
}
