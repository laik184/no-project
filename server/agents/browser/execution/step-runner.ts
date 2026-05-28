/**
 * server/agents/browser/execution/step-runner.ts
 *
 * Executes a single orchestration step via tool-coordinator.
 * Records step outcome into the coordination context.
 * Returns a typed step result — never throws.
 */

import {
  coordinateFlowStep,
  coordinateNavigate,
  coordinateScreenshot,
  coordinateValidateUI,
}                              from '../coordination/tool-coordinator.ts';
import { recordStep }          from '../core/browser-context.ts';
import { logStep }             from '../telemetry/browser-logger.ts';
import { recordStepMetric }    from '../telemetry/browser-metrics.ts';
import { generateStepId, toErrorMessage } from '../utils/browser-utils.ts';
import type { FlowStep }       from '../types/navigation.types.ts';
import type { ToolExecutionContext } from '../coordination/dispatcher-client.ts';

export interface StepInput {
  kind:      'navigate' | 'flow-step' | 'screenshot' | 'validate';
  url?:      string;
  flowStep?: FlowStep;
  label?:    string;
  allowedHosts?: string[];
}

export interface StepResult {
  stepId:    string;
  kind:      string;
  ok:        boolean;
  durationMs: number;
  data?:     unknown;
  error?:    string;
}

// ── Core runner ───────────────────────────────────────────────────────────────

export async function runStep(
  input: StepInput,
  ctx:   ToolExecutionContext,
): Promise<StepResult> {
  const stepId = generateStepId();
  const start  = Date.now();

  let toolResult: { ok: boolean; data?: unknown; error?: string };

  try {
    switch (input.kind) {
      case 'navigate': {
        const r = await coordinateNavigate(input.url!, ctx, {
          allowedHosts: input.allowedHosts,
        });
        toolResult = r.ok
          ? { ok: true,  data: r.data }
          : { ok: false, error: r.error };
        break;
      }
      case 'flow-step': {
        const r = await coordinateFlowStep(input.flowStep!, ctx);
        toolResult = r.ok
          ? { ok: true,  data: r.data }
          : { ok: false, error: r.error };
        break;
      }
      case 'screenshot': {
        const r = await coordinateScreenshot(input.label ?? 'capture', ctx);
        toolResult = r.ok
          ? { ok: true,  data: r.data }
          : { ok: false, error: r.error };
        break;
      }
      case 'validate': {
        const r = await coordinateValidateUI(ctx);
        toolResult = r.ok
          ? { ok: true,  data: r.data }
          : { ok: false, error: r.error };
        break;
      }
      default:
        toolResult = { ok: false, error: `Unknown step kind: ${input.kind}` };
    }
  } catch (err) {
    toolResult = { ok: false, error: toErrorMessage(err) };
  }

  const durationMs = Date.now() - start;
  const result: StepResult = { stepId, kind: input.kind, durationMs, ...toolResult };

  // Record into context and telemetry
  recordStep(ctx.runId, {
    stepId,
    tool:  input.kind,
    ok:    result.ok,
    durationMs,
    error: result.error,
    ts:    new Date().toISOString(),
  });
  logStep(ctx.runId, input.kind, result.ok, durationMs, result.error);
  recordStepMetric(input.kind, result.ok, durationMs);

  return result;
}
