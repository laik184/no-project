/**
 * server/agents/browser/execution/browser-loop.ts
 *
 * MAIN browser runtime loop.
 * Controls: session lifecycle, routing, execution, retry, teardown.
 * Orchestrates only — all work delegated to coordinator/executor layers.
 *
 * Session lifecycle (launch/close) routes through dispatcher-client → tool-dispatcher.
 * No direct imports from server/tools/browser/ are allowed here.
 */

import {
  launchSession,
  closeSession,
  buildToolContext,
  type LaunchSessionResult,
}                                       from '../coordination/dispatcher-client.ts';
import { executeFlow }                  from './flow-executor.ts';
import { routeBrowserGoal }             from '../coordination/browser-routing.ts';
import {
  createContext,
  setStatus,
  finalizeContext,
}                                       from '../core/browser-context.ts';
import { logSessionStart, logSessionEnd } from '../telemetry/browser-logger.ts';
import { recordRunMetric }              from '../telemetry/browser-metrics.ts';
import { browserBus }                   from '../events/browser-events.ts';
import { toErrorMessage }               from '../utils/browser-utils.ts';
import type { BrowserGoal }             from '../coordination/browser-routing.ts';
import type { FlowExecutionResult }     from './flow-executor.ts';

export interface BrowserLoopResult {
  ok:         boolean;
  sessionId:  string;
  steps:      FlowExecutionResult['steps'];
  durationMs: number;
  error?:     string;
}

// ── Main loop ─────────────────────────────────────────────────────────────────

export async function runBrowserLoop(
  goal:      BrowserGoal,
  runId:     string,
  projectId: string,
): Promise<BrowserLoopResult> {
  const start = Date.now();

  // 1. Create coordination context
  createContext(runId, projectId, JSON.stringify(goal.type), goal.url);
  setStatus(runId, 'planning');

  // 2. Route goal → strategy
  const decision = routeBrowserGoal(goal);

  // 3. Launch browser session via dispatcher-client → tool-dispatcher
  setStatus(runId, 'executing');
  const launchCtx = buildToolContext(runId, projectId);
  const launch    = await launchSession(launchCtx, true, goal.timeoutMs ?? 30_000);

  if (!launch.ok) {
    const error = launch.error ?? 'Failed to launch browser';
    finalizeContext(runId, false, error);
    return { ok: false, sessionId: '', steps: [], durationMs: Date.now() - start, error };
  }

  const sessionId = (launch.data as LaunchSessionResult).sessionId;

  logSessionStart(runId, sessionId, goal.url);
  browserBus.emit('session.started', {
    sessionId,
    runId,
    url: goal.url,
    ts:  new Date().toISOString(),
  });

  // 4. Build tool context with session metadata
  const ctx = buildToolContext(runId, projectId, { sessionId });

  // 5. Execute goal
  let execResult: FlowExecutionResult;
  try {
    execResult = await executeFlow(goal, decision, ctx);
  } catch (err) {
    execResult = {
      ok:         false,
      steps:      [],
      durationMs: Date.now() - start,
      error:      toErrorMessage(err),
    };
  }

  // 6. Close session via dispatcher-client → tool-dispatcher
  const closeCtx = buildToolContext(runId, projectId);
  await closeSession(closeCtx);

  const durationMs = Date.now() - start;

  // 7. Finalize
  finalizeContext(runId, execResult.ok, execResult.error);
  logSessionEnd(runId, sessionId, execResult.ok, durationMs);
  recordRunMetric(runId, execResult.ok, durationMs, execResult.steps.length);

  browserBus.emit(execResult.ok ? 'session.closed' : 'session.crashed', {
    sessionId,
    runId,
    url:   goal.url,
    error: execResult.error,
    ts:    new Date().toISOString(),
  });

  return {
    ok:         execResult.ok,
    sessionId,
    steps:      execResult.steps,
    durationMs,
    error:      execResult.error,
  };
}
