/**
 * server/agents/browser/execution/browser-loop.ts
 *
 * MAIN browser runtime loop.
 * Controls: session lifecycle, routing, execution, retry, teardown.
 * Orchestrates only — all work delegated to coordinator/executor layers.
 */

import { launchBrowser, closeBrowser }  from '../../../tools/browser/session/browser-lifecycle.ts';
import { executeFlow }                  from './flow-executor.ts';
import { routeBrowserGoal }             from '../coordination/browser-routing.ts';
import { buildToolContext }             from '../coordination/dispatcher-client.ts';
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

  // 3. Launch browser session
  setStatus(runId, 'executing');
  const launch = await launchBrowser(runId, {
    headless:   true,
    timeoutMs:  goal.timeoutMs ?? 30_000,
    projectId:  projectId ? Number(projectId) : undefined,
  });

  if (!launch.ok) {
    const error = launch.error ?? 'Failed to launch browser';
    finalizeContext(runId, false, error);
    return { ok: false, sessionId: '', steps: [], durationMs: Date.now() - start, error };
  }

  logSessionStart(runId, launch.sessionId, goal.url);
  browserBus.emit('session.started', {
    sessionId: launch.sessionId,
    runId,
    url: goal.url,
    ts:  new Date().toISOString(),
  });

  // 4. Build tool context
  const ctx = buildToolContext(runId, projectId, { sessionId: launch.sessionId });

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

  // 6. Close session
  await closeBrowser(runId);
  const durationMs = Date.now() - start;

  // 7. Finalize
  finalizeContext(runId, execResult.ok, execResult.error);
  logSessionEnd(runId, launch.sessionId, execResult.ok, durationMs);
  recordRunMetric(runId, execResult.ok, durationMs, execResult.steps.length);

  browserBus.emit(execResult.ok ? 'session.closed' : 'session.crashed', {
    sessionId: launch.sessionId,
    runId,
    url:   goal.url,
    error: execResult.error,
    ts:    new Date().toISOString(),
  });

  return {
    ok:         execResult.ok,
    sessionId:  launch.sessionId,
    steps:      execResult.steps,
    durationMs,
    error:      execResult.error,
  };
}
