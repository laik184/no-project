/**
 * server/agents/terminal/monitoring/runtime-monitor.ts
 *
 * Tracks active sessions, execution state, and health of running agent loops.
 * Used by the executor layer (context.ts, task-executor.ts).
 *
 * Public interface:
 *   init(runId, taskCount)    — register a new run
 *   recordStep(runId, success) — record a step result
 *   isHealthy(runId)          — check run health (failure-rate gate)
 *   clear(runId)              — release run state
 *   check(runId, port?)       — async health probe
 *   last(runId)               — last health snapshot
 */

import type { RuntimeHealth } from '../types/terminal.types.ts';

interface SessionRecord {
  runId:        string;
  taskCount:    number;
  stepCount:    number;
  failureCount: number;
  startedAt:    number;
  lastChecked:  number;
}

const FAILURE_RATE_THRESHOLD = 0.6; // >60% failure rate = unhealthy
const MIN_STEPS_FOR_HEALTH   = 3;   // need at least N steps before judging

const sessions = new Map<string, SessionRecord>();
const snapshots = new Map<string, RuntimeHealth>();

export const runtimeMonitor = {
  /** Register a new run. Called from createExecutionContext. */
  init(runId: string, taskCount: number): void {
    sessions.set(runId, {
      runId,
      taskCount,
      stepCount:    0,
      failureCount: 0,
      startedAt:    Date.now(),
      lastChecked:  Date.now(),
    });
  },

  /** Record a completed step. Called from task-executor. */
  recordStep(runId: string, success: boolean): void {
    const s = sessions.get(runId);
    if (!s) return;
    s.stepCount++;
    if (!success) s.failureCount++;
    s.lastChecked = Date.now();

    const health: RuntimeHealth = {
      runId,
      taskCount:    s.taskCount,
      stepCount:    s.stepCount,
      failureCount: s.failureCount,
      isHealthy:    this.isHealthy(runId),
      checkedAt:    Date.now(),
    };
    snapshots.set(runId, health);
  },

  /**
   * Returns false when the failure rate exceeds the threshold
   * and there are enough steps to be statistically meaningful.
   */
  isHealthy(runId: string): boolean {
    const s = sessions.get(runId);
    if (!s) return true; // unknown → optimistic
    if (s.stepCount < MIN_STEPS_FOR_HEALTH) return true;
    const failureRate = s.failureCount / s.stepCount;
    return failureRate <= FAILURE_RATE_THRESHOLD;
  },

  /** Async health probe — checks port liveness if provided. */
  async check(runId: string, port?: number): Promise<RuntimeHealth> {
    const s = sessions.get(runId);
    const stepCount    = s?.stepCount    ?? 0;
    const failureCount = s?.failureCount ?? 0;
    const taskCount    = s?.taskCount    ?? 0;

    let portAlive = false;
    if (port) {
      try {
        const { isPortInUse } = await import('../../../tools/terminal/ports/find-free-port.ts');
        portAlive = await isPortInUse(port);
      } catch {
        portAlive = false;
      }
    }

    const health: RuntimeHealth = {
      runId,
      taskCount,
      stepCount,
      failureCount,
      isHealthy: port ? portAlive : this.isHealthy(runId),
      checkedAt: Date.now(),
    };
    snapshots.set(runId, health);
    return health;
  },

  /** Return the last computed health snapshot for a run. */
  last(runId: string): RuntimeHealth | undefined {
    return snapshots.get(runId);
  },

  /** Release all state for a run. Called from releaseExecutionContext. */
  clear(runId: string): void {
    sessions.delete(runId);
    snapshots.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...sessions.keys()]);
  },
};
