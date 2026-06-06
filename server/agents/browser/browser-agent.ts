/**
 * server/agents/browser/browser-agent.ts
 *
 * PUBLIC entry point for the Browser Agent.
 * Orchestrates the full browser automation lifecycle for a single run.
 * Delegates ALL execution to the loop/execution layer — zero direct tool calls.
 */

import { runBrowserLoop, type BrowserLoopResult } from './execution/browser-loop.ts';
import {
  classifyGoalType,
  type BrowserGoal,
}                                                  from './coordination/browser-routing.ts';
import { validateAgentContext }                    from './validation/state-validator.ts';
import { validateFlowIntegrity }                   from './validation/integrity-validator.ts';
import { summarizeFailures }                       from './monitoring/failure-monitor.ts';
import { getAgentMetrics }                         from './telemetry/browser-metrics.ts';
import { toErrorMessage }                          from './utils/browser-utils.ts';
import type { FlowStep }                           from './types/navigation.types.ts';
import { memoryEngine, buildMemoryContext }         from '../../memory/index.ts';

// ── Agent input ───────────────────────────────────────────────────────────────

export interface BrowserAgentInput {
  url:             string;
  runId:           string;
  projectId:       string;
  allowedHosts?:   string[];
  flows?:          Array<{ name: string; steps: FlowStep[] }>;
  testResponsive?: boolean;
  captureScreenshot?: boolean;
  validateUI?:     boolean;
  timeoutMs?:      number;
}

// ── Agent output ──────────────────────────────────────────────────────────────

export interface BrowserAgentResult {
  ok:             boolean;
  runId:          string;
  sessionId:      string;
  stepsExecuted:  number;
  durationMs:     number;
  integrityOk:    boolean;
  failureSummary?: ReturnType<typeof summarizeFailures>;
  error?:         string;
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function runBrowserAgent(
  input: BrowserAgentInput,
): Promise<BrowserAgentResult> {
  const { runId, projectId, url } = input;

  // 1. Build goal
  const goal: BrowserGoal = {
    type:              classifyGoalType({
      flows:          input.flows,
      testResponsive: input.testResponsive,
    }),
    url,
    allowedHosts:      input.allowedHosts,
    flows:             input.flows,
    testResponsive:    input.testResponsive,
    captureScreenshot: input.captureScreenshot,
    validateUI:        input.validateUI,
    timeoutMs:         input.timeoutMs,
  };

  // 1b. Recall memory context before browser execution
  const memCtx = await buildMemoryContext(`browser automation ${url}`, {
    categories: ['learning', 'bug', 'execution', 'reflection'],
  });
  if (memCtx.totalFound > 0) {
    console.log(`[browser-agent] Memory context — ${memCtx.totalFound} records, hasGraph=${memCtx.hasGraphData}`);
  }

  // 2. Run the browser loop
  let loopResult: BrowserLoopResult;
  try {
    loopResult = await runBrowserLoop(goal, runId, projectId);
  } catch (err) {
    return {
      ok:            false,
      runId,
      sessionId:     '',
      stepsExecuted: 0,
      durationMs:    0,
      integrityOk:   false,
      error:         toErrorMessage(err),
    };
  }

  // 3. Post-run integrity check
  const integrity    = validateFlowIntegrity(loopResult.steps);
  const failures     = summarizeFailures(runId);
  const contextCheck = validateAgentContext(runId);

  if (!integrity.ok) {
    console.warn(`[browser-agent] Integrity violations for runId=${runId}: ${integrity.summary}`);
  }
  if (!contextCheck.ok) {
    console.warn(`[browser-agent] Context validation failed for runId=${runId}: ${contextCheck.summary}`);
  }

  // Fire-and-forget: persist browser run outcome to memory platform
  memoryEngine.store({
    category: 'learning',
    content:  JSON.stringify({ url, ok: loopResult.ok, stepsExecuted: loopResult.steps.length, integrityOk: integrity.ok, durationMs: loopResult.durationMs }),
    tags:     ['browser', loopResult.ok ? 'success' : 'failure'],
    score:    loopResult.ok ? 0.9 : 0.2,
    meta:     { runId, projectId, agentSource: 'browser' },
  }).catch(console.error);

  return {
    ok:             loopResult.ok,
    runId,
    sessionId:      loopResult.sessionId,
    stepsExecuted:  loopResult.steps.length,
    durationMs:     loopResult.durationMs,
    integrityOk:    integrity.ok,
    failureSummary: failures.total > 0 ? failures : undefined,
    error:          loopResult.error,
  };
}

// ── Metrics accessor ──────────────────────────────────────────────────────────

export { getAgentMetrics as getBrowserAgentMetrics };
