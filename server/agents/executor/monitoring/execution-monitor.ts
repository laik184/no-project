/**
 * server/agents/executor/monitoring/execution-monitor.ts
 *
 * Tracks active execution state, progress, and stuck loops.
 * Pure in-process monitor — no execution logic.
 */

import type { ExecutionMonitorSnapshot, ExecutionSessionStatus } from '../types/executor.types.ts';

interface ActiveExecution {
  runId:         string;
  sessionId:     string;
  status:        ExecutionSessionStatus;
  tasksTotal:    number;
  tasksDone:     number;
  activeStepId?: string;
  startedAt:     Date;
  lastProgressAt: Date;
}

const _active = new Map<string, ActiveExecution>();
const STUCK_THRESHOLD_MS = 120_000; // 2 minutes without progress = stuck

export const executionMonitor = {
  register(runId: string, sessionId: string, tasksTotal: number): void {
    _active.set(runId, {
      runId, sessionId,
      status:   'planning',
      tasksTotal,
      tasksDone: 0,
      startedAt: new Date(),
      lastProgressAt: new Date(),
    });
  },

  setStatus(runId: string, status: ExecutionSessionStatus): void {
    const e = _active.get(runId);
    if (e) e.status = status;
  },

  setActiveStep(runId: string, stepId: string): void {
    const e = _active.get(runId);
    if (e) { e.activeStepId = stepId; e.lastProgressAt = new Date(); }
  },

  clearActiveStep(runId: string): void {
    const e = _active.get(runId);
    if (e) e.activeStepId = undefined;
  },

  incrementDone(runId: string): void {
    const e = _active.get(runId);
    if (e) { e.tasksDone++; e.lastProgressAt = new Date(); }
  },

  isStuck(runId: string): boolean {
    const e = _active.get(runId);
    if (!e || e.status !== 'running') return false;
    return (Date.now() - e.lastProgressAt.getTime()) > STUCK_THRESHOLD_MS;
  },

  snapshot(runId: string): ExecutionMonitorSnapshot | undefined {
    const e = _active.get(runId);
    if (!e) return undefined;
    const progressPct = e.tasksTotal === 0 ? 0 : Math.round((e.tasksDone / e.tasksTotal) * 100);
    return {
      runId:         e.runId,
      sessionId:     e.sessionId,
      status:        e.status,
      tasksTotal:    e.tasksTotal,
      tasksDone:     e.tasksDone,
      activeStepId:  e.activeStepId,
      stuckStepId:   this.isStuck(runId) ? e.activeStepId : undefined,
      progressPct,
    };
  },

  allSnapshots(): ExecutionMonitorSnapshot[] {
    return [..._active.keys()].map((r) => this.snapshot(r)).filter(Boolean) as ExecutionMonitorSnapshot[];
  },

  deregister(runId: string): void { _active.delete(runId); },
  reset(): void { _active.clear(); },
};
