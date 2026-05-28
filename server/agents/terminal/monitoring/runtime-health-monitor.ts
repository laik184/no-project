/**
 * server/agents/terminal/monitoring/runtime-health-monitor.ts
 *
 * Tracks active sessions, execution state, and stuck execution loops.
 * Exports:
 *   runtimeMonitor       — session-level health tracking (used by executor context)
 *   runtimeHealthMonitor — periodic stuck-session sweep
 */

import { failureMonitor }  from './failure-monitor.ts';
import { terminalLogger }  from '../telemetry/terminal-logger.ts';

// ── Per-session record ────────────────────────────────────────────────────────

interface SessionRecord {
  runId:        string;
  taskCount:    number;
  stepCount:    number;
  failureCount: number;
  lastActivity: number;
}

export interface RuntimeHealth {
  runId:        string;
  taskCount:    number;
  stepCount:    number;
  failureCount: number;
  isHealthy:    boolean;
  checkedAt:    number;
}

const FAILURE_RATE_THRESHOLD = 0.6;
const MIN_STEPS_FOR_HEALTH   = 3;

const sessions  = new Map<string, SessionRecord>();
const snapshots = new Map<string, RuntimeHealth>();

// ── runtimeMonitor ────────────────────────────────────────────────────────────

export const runtimeMonitor = {
  init(runId: string, taskCount: number): void {
    sessions.set(runId, { runId, taskCount, stepCount: 0, failureCount: 0, lastActivity: Date.now() });
  },

  recordStep(runId: string, success: boolean): void {
    const s = sessions.get(runId);
    if (!s) return;
    s.stepCount++;
    if (!success) s.failureCount++;
    s.lastActivity = Date.now();
    snapshots.set(runId, {
      runId, taskCount: s.taskCount, stepCount: s.stepCount,
      failureCount: s.failureCount,
      isHealthy: runtimeMonitor.isHealthy(runId),
      checkedAt: Date.now(),
    });
  },

  isHealthy(runId: string): boolean {
    const s = sessions.get(runId);
    if (!s || s.stepCount < MIN_STEPS_FOR_HEALTH) return true;
    return (s.failureCount / s.stepCount) <= FAILURE_RATE_THRESHOLD;
  },

  async check(runId: string): Promise<RuntimeHealth> {
    const s = sessions.get(runId);
    const health: RuntimeHealth = {
      runId,
      taskCount:    s?.taskCount    ?? 0,
      stepCount:    s?.stepCount    ?? 0,
      failureCount: s?.failureCount ?? 0,
      isHealthy:    runtimeMonitor.isHealthy(runId),
      checkedAt:    Date.now(),
    };
    snapshots.set(runId, health);
    return health;
  },

  last(runId: string): RuntimeHealth | undefined { return snapshots.get(runId); },

  clear(runId: string): void { sessions.delete(runId); snapshots.delete(runId); },

  allRunIds(): readonly string[] { return Object.freeze([...sessions.keys()]); },
};

// ── Periodic health sweep ─────────────────────────────────────────────────────

const STUCK_THRESHOLD_MS = 10 * 60_000;
const SWEEP_INTERVAL_MS  = 60_000;

interface StuckSession { runId: string; idleMs: number; failureRate: number; }

let sweepTimer: ReturnType<typeof setInterval> | null = null;

function detectStuck(): StuckSession[] {
  const stuck: StuckSession[] = [];
  const now = Date.now();
  for (const runId of runtimeMonitor.allRunIds()) {
    const h = runtimeMonitor.last(runId);
    if (!h) continue;
    const idleMs = now - h.checkedAt;
    if (idleMs < STUCK_THRESHOLD_MS) continue;
    const failureRate = h.stepCount > 0 ? h.failureCount / h.stepCount : 0;
    stuck.push({ runId, idleMs, failureRate });
    terminalLogger.warn(runId, '[health-monitor] Stuck session detected', { idleMs, failureRate: failureRate.toFixed(2) });
  }
  return stuck;
}

export const runtimeHealthMonitor = {
  start(): void {
    if (sweepTimer) return;
    sweepTimer = setInterval(() => {
      const stuck = detectStuck();
      if (stuck.length > 0)
        console.warn(`[terminal-health-monitor] ${stuck.length} stuck session(s)`, stuck.map((s) => s.runId).join(', '));
    }, SWEEP_INTERVAL_MS);
    if (sweepTimer && typeof sweepTimer === 'object' && 'unref' in sweepTimer)
      (sweepTimer as NodeJS.Timeout).unref();
  },

  stop(): void {
    if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
  },

  snapshot(): { activeSessions: number; stuckSessions: StuckSession[]; totalFailures: number } {
    const runIds = runtimeMonitor.allRunIds();
    return {
      activeSessions: runIds.length,
      stuckSessions:  detectStuck(),
      totalFailures:  runIds.reduce((sum, id) => sum + failureMonitor.countForRun(id), 0),
    };
  },
};
