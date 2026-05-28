/**
 * server/agents/terminal/terminal-agent.ts
 *
 * Terminal Agent — top-level orchestration coordinator.
 *
 * Responsibilities (orchestration ONLY):
 *   - Accept terminal execution requests
 *   - Validate requests before dispatching
 *   - Coordinate session lifecycle
 *   - Route through the execution runner
 *   - Emit telemetry and monitor health
 *
 * NEVER: spawn processes, execute shell commands, call npm directly.
 * ALL execution goes through coordination/dispatcher-client.ts.
 */

import { runTerminal, type TerminalRunRequest } from './execution/terminal-runner.ts';
import { validateExecutionRequest }             from './validation/execution-validator.ts';
import { runtimeHealthMonitor }                 from './monitoring/runtime-health-monitor.ts';
import { terminalLogger }                        from './telemetry/terminal-logger.ts';
import { terminalMetrics }                       from './telemetry/terminal-metrics.ts';
import { generateId }                            from './utils/execution-utils.ts';
import type { ExecutionStep, LoopResult as AgentLoopResult } from './types/terminal.types.ts';
import type { LoopResult }                       from './execution/execution-loop.ts';

export interface TerminalAgentRequest {
  runId?:      string;
  projectId:   string;
  sandboxRoot?: string;
  steps:       readonly ExecutionStep[];
}

export interface TerminalAgentResult {
  readonly runId:          string;
  readonly ok:             boolean;
  readonly stepsTotal:     number;
  readonly stepsSucceeded: number;
  readonly stepsFailed:    number;
  readonly durationMs:     number;
  readonly error?:         string;
}

let _started = false;

/** Initialize the terminal agent — starts health monitor. */
export function initTerminalAgent(): void {
  if (_started) return;
  _started = true;
  runtimeHealthMonitor.start();
  terminalLogger.info('system', 'Terminal agent initialized');
}

/** Shut down the terminal agent gracefully. */
export function shutdownTerminalAgent(): void {
  runtimeHealthMonitor.stop();
  terminalLogger.info('system', 'Terminal agent shut down');
}

/**
 * Execute a terminal session: validate → run → report.
 * This is the main entry point for the terminal agent.
 */
export async function executeTerminalSession(
  req: TerminalAgentRequest,
): Promise<TerminalAgentResult> {
  const runId = req.runId ?? generateId('run');

  const validation = validateExecutionRequest(runId, req.projectId, req.steps);
  if (!validation.valid) {
    terminalLogger.error(runId, `Request validation failed`, { errors: validation.errors });
    return {
      runId,
      ok:             false,
      stepsTotal:     req.steps.length,
      stepsSucceeded: 0,
      stepsFailed:    req.steps.length,
      durationMs:     0,
      error:          validation.errors.join('; '),
    };
  }

  terminalLogger.info(runId, `Terminal agent executing`, {
    projectId: req.projectId,
    steps:     req.steps.length,
  });
  terminalMetrics.initRun(runId);

  const runReq: TerminalRunRequest = {
    runId,
    projectId:   req.projectId,
    sandboxRoot: req.sandboxRoot,
    steps:       req.steps,
  };

  const result: LoopResult = await runTerminal(runReq);

  const snap = terminalMetrics.getSnapshot(runId);
  terminalLogger.info(runId, `Terminal agent done`, {
    ok:             result.ok,
    stepsSucceeded: result.stepsSucceeded,
    stepsFailed:    result.stepsFailed,
    durationMs:     result.durationMs,
    successRate:    snap ? (snap.successSteps / Math.max(snap.totalSteps, 1)).toFixed(2) : '?',
  });

  return {
    runId:          result.runId,
    ok:             result.ok,
    stepsTotal:     result.stepsTotal,
    stepsSucceeded: result.stepsSucceeded,
    stepsFailed:    result.stepsFailed,
    durationMs:     result.durationMs,
  };
}
