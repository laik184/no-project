/**
 * server/agents/terminal/core/terminal-session.ts
 *
 * Session lifecycle manager for the terminal agent.
 * Wraps terminal-state with session-level bookkeeping.
 * Pure orchestration — no tool calls, no direct execution.
 */

import type { TerminalSessionMeta, SessionStatus, TerminalPhase } from '../types/terminal.types.ts';
import { terminalState }   from './terminal-state.ts';
import { terminalLogger }  from '../telemetry/terminal-logger.ts';
import { terminalMetrics } from '../telemetry/terminal-metrics.ts';
import { runtimeMonitor }  from '../monitoring/runtime-health-monitor.ts';
import { failureMonitor }  from '../monitoring/failure-monitor.ts';

export interface SessionConfig {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  totalSteps:  number;
}

export const terminalSession = {
  open(config: SessionConfig): TerminalSessionMeta {
    const { runId, projectId, sandboxRoot, totalSteps } = config;
    const stateData = terminalState.init(runId, projectId, totalSteps);
    terminalMetrics.initRun(runId);
    runtimeMonitor.init(runId, totalSteps);
    failureMonitor.initRun(runId);
    terminalLogger.sessionStart(runId, projectId, totalSteps);
    return buildMeta(stateData.runId, stateData.projectId, sandboxRoot, stateData.status, stateData.phase, stateData.totalSteps, stateData.completedSteps, stateData.failedSteps, new Date(stateData.startedAt));
  },

  transition(runId: string, phase: TerminalPhase): void {
    terminalState.setPhase(runId, phase);
    terminalLogger.debug(runId, `phase → ${phase}`);
  },

  setStatus(runId: string, status: SessionStatus): void {
    terminalState.setStatus(runId, status);
  },

  snapshot(runId: string, sandboxRoot: string): TerminalSessionMeta | undefined {
    const s = terminalState.get(runId);
    if (!s) return undefined;
    return buildMeta(s.runId, s.projectId, sandboxRoot, s.status, s.phase, s.totalSteps, s.completedSteps, s.failedSteps, new Date(s.startedAt));
  },

  close(runId: string, success: boolean, durationMs: number): void {
    const status: SessionStatus = success ? 'completed' : 'failed';
    terminalState.setStatus(runId, status);
    terminalState.setPhase(runId, success ? 'completing' : 'failed');
    terminalMetrics.finalise(runId);
    runtimeMonitor.clear(runId);
    failureMonitor.clearRun(runId);
    terminalLogger.sessionEnd(runId, success, durationMs);
  },

  release(runId: string): void {
    terminalState.clear(runId);
    terminalMetrics.clear(runId);
  },
};

function buildMeta(
  runId: string, projectId: string, sandboxRoot: string,
  status: SessionStatus, phase: TerminalPhase,
  totalSteps: number, completedSteps: number, failedSteps: number,
  startedAt: Date,
): TerminalSessionMeta {
  return { runId, projectId, sandboxRoot, startedAt, status, phase, totalSteps, completedSteps, failedSteps };
}
