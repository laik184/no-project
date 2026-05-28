/**
 * server/agents/coderx/monitoring/execution-monitor.ts
 *
 * Tracks active coding state, execution progress, and detects stuck loops.
 * Pure observation — no execution, no dispatcher calls.
 */

import type {
  CoderXMonitorSnapshot,
  CodingSessionStatus,
} from '../types/coderx.types.ts';
import { getSession }    from '../core/coderx-session.ts';
import { listByStatus }  from '../core/coderx-state.ts';
import { elapsedMs }     from '../utils/coding-utils.ts';

// ── Stuck detection threshold ─────────────────────────────────────────────────

const STUCK_THRESHOLD_MS = 60_000;

// ── Per-run active step tracking ──────────────────────────────────────────────

const _activeSteps = new Map<string, { stepId: string; since: Date }>();

export const executionMonitor = {

  markStepActive(runId: string, stepId: string): void {
    _activeSteps.set(runId, { stepId, since: new Date() });
  },

  clearActiveStep(runId: string): void {
    _activeSteps.delete(runId);
  },

  snapshot(sessionId: string, runId: string): CoderXMonitorSnapshot {
    const session = getSession(sessionId);
    const status: CodingSessionStatus = session?.status ?? 'idle';

    const running = listByStatus('running');
    const active  = _activeSteps.get(runId);
    const stuck   = detectStuck(runId);

    const tasksTotal = session?.tasksTotal ?? 0;
    const tasksDone  = session?.tasksDone  ?? 0;
    const progressPct = tasksTotal > 0
      ? Math.round((tasksDone / tasksTotal) * 100)
      : 0;

    return {
      runId,
      sessionId,
      status,
      tasksTotal,
      tasksDone,
      progressPct,
      activeStepId: active?.stepId ?? running[0]?.step.stepId,
      stuckStepId:  stuck?.stepId,
    };
  },

  isStuck(runId: string): boolean {
    return detectStuck(runId) !== null;
  },
};

function detectStuck(
  runId: string,
): { stepId: string } | null {
  const entry = _activeSteps.get(runId);
  if (!entry) return null;
  if (elapsedMs(entry.since) > STUCK_THRESHOLD_MS) {
    return { stepId: entry.stepId };
  }
  return null;
}
