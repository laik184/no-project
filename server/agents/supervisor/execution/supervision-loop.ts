/**
 * server/agents/supervisor/execution/supervision-loop.ts
 *
 * THE HEART of the supervisor agent.
 *
 * Controls the supervision lifecycle:
 *   - iterates tasks in priority order
 *   - routes each task via task-runner → coordination → dispatcher → tools
 *   - manages retries, escalation, and health guards
 *   - drives the session to completion or controlled failure
 *
 * Architecture: orchestration ONLY.
 * No child_process. No spawn. No exec. No shell. No direct tool calls.
 */

import type { SupervisionTask, TaskOutcome, RecoveryAction } from '../types/supervisor.types.ts';
import type { SupervisionContext }                            from '../core/supervisor-context.ts';
import { supervisorState }                                   from '../core/supervisor-state.ts';
import { supervisorSession }                                 from '../core/supervisor-session.ts';
import { failureMonitor }                                    from '../monitoring/failure-monitor.ts';
import { supervisorLogger }                                  from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics }                                 from '../telemetry/supervisor-metrics.ts';
import { decideRecovery }                                    from '../utils/supervision-utils.ts';
import { runTask }                                           from './task-runner.ts';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CONSECUTIVE_FAILURES  = 5;
const FAILURE_RATE_ABORT_THRESH = 0.8;

// ── Priority order ────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<SupervisionTask['priority'], number> = {
  critical: 0,
  high:     1,
  normal:   2,
  low:      3,
};

function sortByPriority(tasks: readonly SupervisionTask[]): SupervisionTask[] {
  return [...tasks].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );
}

// ── Supervision loop ──────────────────────────────────────────────────────────

export async function runSupervisionLoop(
  tasks:   readonly SupervisionTask[],
  context: SupervisionContext,
): Promise<TaskOutcome[]> {
  const { runId } = context;
  const ordered   = sortByPriority(tasks);
  const outcomes: TaskOutcome[] = [];
  let consecutiveFailures = 0;

  supervisorLogger.info(runId, `Supervision loop starting — ${ordered.length} task(s)`);
  supervisorSession.transition(runId, 'supervising');

  for (const task of ordered) {
    // ── Abort guard: consecutive failure limit ────────────────────────────────
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      supervisorLogger.error(runId, `Aborting: ${consecutiveFailures} consecutive failures`);
      supervisorSession.transition(runId, 'failed');
      supervisorState.setStatus(runId, 'failed');
      break;
    }

    // ── Abort guard: overall failure rate ─────────────────────────────────────
    const failRate = supervisorState.failureRate(runId);
    if (failRate >= FAILURE_RATE_ABORT_THRESH) {
      supervisorLogger.error(runId, `Aborting: failure rate ${(failRate * 100).toFixed(0)}% exceeds threshold`);
      supervisorSession.transition(runId, 'failed');
      supervisorState.setStatus(runId, 'failed');
      break;
    }

    // ── Abort guard: crash-loop detection ─────────────────────────────────────
    if (failureMonitor.isCrashLooping(runId)) {
      supervisorLogger.error(runId, 'Crash loop detected — aborting supervision');
      supervisorSession.transition(runId, 'failed');
      supervisorState.setStatus(runId, 'failed');
      break;
    }

    // ── Run this task ─────────────────────────────────────────────────────────
    const outcome = await runTask(task, context);
    outcomes.push(outcome);

    // ── Record outcome in state + metrics ─────────────────────────────────────
    supervisorState.recordOutcome(runId, outcome);
    supervisorMetrics.recordTask(runId, outcome.success, outcome.durationMs);

    if (outcome.success) {
      consecutiveFailures = 0;
      supervisorLogger.task(runId, task.id, 'ok', {
        durationMs: outcome.durationMs,
        attempt:    outcome.attempt,
      });
    } else {
      consecutiveFailures++;
      const action = decidePostFailureAction(outcome.error ?? '', task.retryLimit, outcome.attempt);

      supervisorLogger.warn(runId, `Task ${task.id} failed — action=${action}`, {
        error: outcome.error, domain: task.domain, consecutiveFailures,
      });

      if (action === 'escalate') {
        supervisorSession.transition(runId, 'escalating');
        supervisorLogger.escalate(runId, task.id, outcome.error ?? 'unknown reason');
        supervisorMetrics.recordEscalation(runId);
        failureMonitor.recordEscalation(runId, task.id, task.domain, outcome.error ?? '');
        supervisorSession.transition(runId, 'failed');
        supervisorState.setStatus(runId, 'failed');
        break;
      }

      if (action === 'abort') {
        supervisorSession.transition(runId, 'failed');
        supervisorState.setStatus(runId, 'failed');
        break;
      }

      // 'skip' — task-runner's retry-manager already exhausted attempts; continue
    }
  }

  supervisorSession.transition(runId, 'completing');
  supervisorLogger.info(runId, `Supervision loop complete — ${outcomes.length} task(s) run`);
  return outcomes;
}

// ── Recovery decision ─────────────────────────────────────────────────────────

function decidePostFailureAction(
  error:      string,
  retryLimit: number,
  attempts:   number,
): RecoveryAction {
  if (attempts >= retryLimit) return 'abort';
  return decideRecovery(error);
}
