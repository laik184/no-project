/**
 * server/agents/browser/execution/flow-executor.ts
 *
 * Converts a browser goal into an ordered sequence of steps and runs them.
 * Delegates each step to step-runner.ts — never dispatches tools directly.
 */

import { runStep, type StepResult } from './step-runner.ts';
import { withRetry, DEFAULT_RETRY, NO_RETRY } from './retry-manager.ts';
import { setStatus }               from '../core/browser-context.ts';
import { toErrorMessage }          from '../utils/browser-utils.ts';
import type { ToolExecutionContext } from '../coordination/dispatcher-client.ts';
import type { BrowserGoal, RoutingDecision } from '../coordination/browser-routing.ts';
import type { FlowStep }           from '../types/navigation.types.ts';

export interface FlowExecutionResult {
  ok:          boolean;
  steps:       StepResult[];
  durationMs:  number;
  error?:      string;
}

// ── Flow execution ────────────────────────────────────────────────────────────

export async function executeFlow(
  goal:     BrowserGoal,
  decision: RoutingDecision,
  ctx:      ToolExecutionContext,
): Promise<FlowExecutionResult> {
  const start   = Date.now();
  const results: StepResult[] = [];

  try {
    // 1. Navigate
    if (decision.shouldNavigate && goal.url) {
      setStatus(ctx.runId, 'executing');
      const nav = await withRetry(
        () => runStep({ kind: 'navigate', url: goal.url, allowedHosts: goal.allowedHosts }, ctx),
        DEFAULT_RETRY,
        'navigate',
      );
      results.push(nav.result);
      if (!nav.result.ok) {
        return { ok: false, steps: results, durationMs: Date.now() - start, error: nav.result.error };
      }
    }

    // 2. Run flows
    if (decision.shouldRunFlows && goal.flows?.length) {
      for (const flow of goal.flows) {
        const flowResult = await runFlowSteps(flow.steps, ctx);
        results.push(...flowResult);
        const failed = flowResult.find(r => !r.ok);
        if (failed) {
          return { ok: false, steps: results, durationMs: Date.now() - start, error: failed.error };
        }
      }
    }

    // 3. Capture screenshot
    if (decision.shouldCapture) {
      setStatus(ctx.runId, 'capturing');
      const ss = await withRetry(
        () => runStep({ kind: 'screenshot', label: 'final' }, ctx),
        NO_RETRY,
        'screenshot',
      );
      results.push(ss.result);
    }

    // 4. Validate UI
    if (decision.shouldValidate) {
      setStatus(ctx.runId, 'validating');
      const val = await runStep({ kind: 'validate' }, ctx);
      results.push(val);
    }

    return { ok: true, steps: results, durationMs: Date.now() - start };

  } catch (err) {
    return {
      ok:         false,
      steps:      results,
      durationMs: Date.now() - start,
      error:      toErrorMessage(err),
    };
  }
}

// ── Internal: run individual flow steps ───────────────────────────────────────

async function runFlowSteps(
  steps: FlowStep[],
  ctx:   ToolExecutionContext,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const step of steps) {
    const result = await runStep({ kind: 'flow-step', flowStep: step }, ctx);
    results.push(result);
    if (!result.ok) break; // Stop flow on first failure
  }
  return results;
}
