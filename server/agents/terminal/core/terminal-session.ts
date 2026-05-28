/**
 * server/agents/terminal/core/terminal-session.ts
 *
 * Manages the lifecycle of a single terminal agent session.
 * Creates, updates, and releases session state.
 */

import { randomUUID }    from 'crypto';
import { terminalState } from './terminal-state.ts';
import { terminalMetrics } from '../telemetry/terminal-metrics.ts';
import { terminalLogger }  from '../telemetry/terminal-logger.ts';
import { runtimeMonitor }  from '../monitoring/runtime-monitor.ts';
import { failureMonitor }  from '../monitoring/failure-monitor.ts';
import type { TerminalSessionMeta } from '../types/terminal.types.ts';

export interface TerminalSession {
  readonly sessionId:  string;
  readonly runId:      string;
  readonly projectId:  string;
  readonly sandboxRoot: string;
  readonly meta:       TerminalSessionMeta;
}

export function createSession(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  taskCount:   number,
): TerminalSession {
  const sessionId = randomUUID();

  const meta = terminalState.init(runId, projectId, sessionId, taskCount);
  terminalMetrics.initRun(runId);
  runtimeMonitor.init(runId, taskCount);
  terminalState.setStatus(runId, 'running');

  terminalLogger.info(runId, `Session created`, { sessionId, projectId, taskCount });

  return Object.freeze({ sessionId, runId, projectId, sandboxRoot, meta });
}

export function releaseSession(session: TerminalSession): void {
  terminalState.setStatus(session.runId, 'completed');
  runtimeMonitor.clear(session.runId);
  failureMonitor.clearRun(session.runId);
  terminalLogger.info(session.runId, `Session released`, { sessionId: session.sessionId });
  terminalState.clear(session.runId);
}
