/**
 * execution/verification-runner.ts
 * Runs a single verification phase by executing its steps.
 */

import type { VerificationPhase, PhaseResult } from '../types/verifier.types.ts';
import type { ExecutionStep, StepResult } from '../types/execution.types.ts';
import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import { runStep } from './step-runner.ts';
import { collectStepErrors, collectStepWarnings } from '../utils/execution-utils.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';

type PhaseResultWithoutDuration = Omit<PhaseResult, 'durationMs'> & { durationMs: number };

export async function runPhase(
  phase:   VerificationPhase,
  steps:   ExecutionStep[],
  context: ToolExecutionContext,
): Promise<PhaseResult> {
  if (steps.length === 0) {
    return { phase, status: 'skipped', durationMs: 0, errors: [], warnings: [] };
  }

  verifierLogger.info(context.runId, `Running phase: ${phase}`, { stepCount: steps.length });

  const results: StepResult[] = [];
  let aborted = false;

  for (const step of steps) {
    const result = await runStep(step, context);
    results.push(result);

    if (!result.passed && step.required) {
      verifierLogger.error(context.runId, `Required step aborted phase: ${step.toolName}`, { phase });
      aborted = true;
      break;
    }
  }

  const errors   = collectStepErrors(results);
  const warnings = collectStepWarnings(results);
  const passed   = !aborted && errors.length === 0;

  verifierMetrics.recordPhase(context.runId, phase, 0, passed);

  return {
    phase,
    status:     passed ? 'passed' : 'failed',
    durationMs: 0,
    errors,
    warnings,
    output:   buildPhaseOutput(results),
    metadata: { stepCount: steps.length, stepsRun: results.length },
  };
}

function buildPhaseOutput(results: StepResult[]): string {
  const parts: string[] = [];
  for (const r of results) {
    const status = r.passed ? '✓' : '✗';
    parts.push(`${status} ${r.toolName} (${r.durationMs}ms)`);
    if (r.errors.length) parts.push(`  Errors: ${r.errors.slice(0, 2).join('; ')}`);
  }
  return parts.join('\n');
}
