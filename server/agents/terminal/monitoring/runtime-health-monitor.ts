/**
 * server/agents/terminal/monitoring/runtime-health-monitor.ts
 *
 * Periodic health sweep for all active terminal agent sessions.
 * Detects stuck execution loops and sessions that have exceeded
 * their expected runtime.
 */

import { runtimeMonitor }  from './runtime-monitor.ts';
import { failureMonitor }  from './failure-monitor.ts';
import { terminalLogger }  from '../telemetry/terminal-logger.ts';

const STUCK_THRESHOLD_MS   = 10 * 60_000; // 10 minutes without progress
const SWEEP_INTERVAL_MS    = 60_000;       // sweep every 60s

interface StuckSession {
  runId:       string;
  idleMs:      number;
  failureRate: number;
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

function detectStuckSessions(): StuckSession[] {
  const stuck: StuckSession[] = [];
  const now = Date.now();

  for (const runId of runtimeMonitor.allRunIds()) {
    const health = runtimeMonitor.last(runId);
    if (!health) continue;

    const idleMs = now - health.checkedAt;
    if (idleMs < STUCK_THRESHOLD_MS) continue;

    const failureRate = health.stepCount > 0
      ? health.failureCount / health.stepCount
      : 0;

    stuck.push({ runId, idleMs, failureRate });
    terminalLogger.warn(runId, `[health-monitor] Stuck session detected`, {
      idleMs,
      failureRate: failureRate.toFixed(2),
      stepCount:   health.stepCount,
    });
  }

  return stuck;
}

export const runtimeHealthMonitor = {
  start(): void {
    if (sweepTimer) return;
    sweepTimer = setInterval(() => {
      const stuck = detectStuckSessions();
      if (stuck.length > 0) {
        console.warn(
          `[terminal-health-monitor] ${stuck.length} stuck session(s):`,
          stuck.map((s) => s.runId).join(', '),
        );
      }
    }, SWEEP_INTERVAL_MS);

    if (sweepTimer && typeof sweepTimer === 'object' && 'unref' in sweepTimer) {
      (sweepTimer as NodeJS.Timeout).unref();
    }
  },

  stop(): void {
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  },

  snapshot(): {
    activeSessions:    number;
    stuckSessions:     StuckSession[];
    totalFailures:     number;
  } {
    const runIds = runtimeMonitor.allRunIds();
    const stuckSessions = detectStuckSessions();
    const totalFailures = runIds.reduce(
      (sum, id) => sum + failureMonitor.countForRun(id),
      0,
    );

    return { activeSessions: runIds.length, stuckSessions, totalFailures };
  },
};
