/**
 * server/agents/supervisor/core/supervisor-session.ts
 *
 * Session lifecycle manager for the supervisor agent.
 * Orchestrates state, metrics, monitoring, and logging for a single run.
 * Pure orchestration — no tool calls, no direct execution.
 */

import type {
  SupervisionSessionMeta,
  SupervisionStatus,
  SupervisionPhase,
} from '../types/supervisor.types.ts';
import { supervisorState }   from './supervisor-state.ts';
import { supervisorLogger }  from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';
import { failureMonitor }    from '../monitoring/failure-monitor.ts';

export interface SessionConfig {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  goal:        string;
  totalTasks:  number;
}

export const supervisorSession = {
  open(config: SessionConfig): SupervisionSessionMeta {
    const { runId, projectId, sandboxRoot, goal, totalTasks } = config;
    const data = supervisorState.init(runId, projectId, goal, totalTasks);
    supervisorMetrics.initRun(runId);
    failureMonitor.initRun(runId);
    supervisorLogger.sessionStart(runId, projectId, goal, totalTasks);
    return buildMeta(data, sandboxRoot);
  },

  transition(runId: string, phase: SupervisionPhase): void {
    supervisorState.setPhase(runId, phase);
    supervisorLogger.debug(runId, `phase → ${phase}`);
  },

  setStatus(runId: string, status: SupervisionStatus): void {
    supervisorState.setStatus(runId, status);
  },

  snapshot(runId: string, sandboxRoot: string): SupervisionSessionMeta | undefined {
    const s = supervisorState.get(runId);
    if (!s) return undefined;
    return buildMeta(s, sandboxRoot);
  },

  close(runId: string, success: boolean, durationMs: number): void {
    const status: SupervisionStatus = success ? 'completed' : 'failed';
    supervisorState.setStatus(runId, status);
    supervisorState.setPhase(runId, success ? 'completing' : 'failed');
    supervisorMetrics.finalise(runId);
    failureMonitor.clearRun(runId);
    supervisorLogger.sessionEnd(runId, success, durationMs);
  },

  release(runId: string): void {
    supervisorState.clear(runId);
    supervisorMetrics.clear(runId);
  },
};

// ── Private helper ─────────────────────────────────────────────────────────────

function buildMeta(
  s:           { runId: string; projectId: string; goal: string; status: SupervisionStatus; phase: SupervisionPhase; totalTasks: number; completedTasks: number; failedTasks: number; startedAt: number },
  sandboxRoot: string,
): SupervisionSessionMeta {
  return {
    runId:          s.runId,
    projectId:      s.projectId,
    sandboxRoot,
    goal:           s.goal,
    startedAt:      new Date(s.startedAt),
    status:         s.status,
    phase:          s.phase,
    totalTasks:     s.totalTasks,
    completedTasks: s.completedTasks,
    failedTasks:    s.failedTasks,
  };
}
