/**
 * orchestration/execution-controller.ts
 * Controls the high-level execution flow — guards, abort checks, timeouts.
 */

import type { VerifierContext } from '../core/verifier-context.ts';
import type { VerificationResult } from '../types/verifier.types.ts';
import type { VerificationPlan } from '../planning/verification-planner.ts';
import { executeVerification } from '../core/verifier-engine.ts';
import { validateVerificationInput } from '../validation/verification-validator.ts';
import { validateRuntimePreconditions } from '../validation/runtime-validator.ts';
import { validatePlan } from '../validation/verification-validator.ts';
import { isTimedOut, elapsedMs } from '../core/verifier-context.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { failureMonitor } from '../monitoring/failure-monitor.ts';

export interface ControllerResult {
  result?:     VerificationResult;
  aborted:     boolean;
  abortReason?: string;
}

export async function controlledExecution(
  ctx:  VerifierContext,
  plan: VerificationPlan,
): Promise<ControllerResult> {
  const runId = ctx.input.runId;

  // ── Pre-flight validation ──────────────────────────────────────────────────
  const inputValidation = validateVerificationInput(ctx.input);
  if (!inputValidation.valid) {
    verifierLogger.error(runId, 'Input validation failed', { errors: inputValidation.errors });
    failureMonitor.reportFailure(runId, inputValidation.errors);
    return { aborted: true, abortReason: inputValidation.errors.join('; ') };
  }

  const runtimeValidation = validateRuntimePreconditions(ctx.input);
  if (!runtimeValidation.ready) {
    verifierLogger.error(runId, 'Runtime precondition failed', { errors: runtimeValidation.errors });
    failureMonitor.reportFailure(runId, runtimeValidation.errors);
    return { aborted: true, abortReason: runtimeValidation.errors.join('; ') };
  }

  const planValidation = validatePlan(plan);
  if (!planValidation.valid) {
    verifierLogger.error(runId, 'Plan validation failed', { errors: planValidation.errors });
    return { aborted: true, abortReason: planValidation.errors.join('; ') };
  }

  if (planValidation.warnings.length) {
    verifierLogger.warn(runId, 'Plan warnings', { warnings: planValidation.warnings });
  }

  // ── Abort signal check ────────────────────────────────────────────────────
  if (ctx.input.abortSignal?.aborted) {
    verifierLogger.warn(runId, 'Aborted before start');
    return { aborted: true, abortReason: 'Aborted via signal' };
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  verifierLogger.info(runId, 'Controlled execution starting', { elapsed: elapsedMs(ctx) });
  const result = await executeVerification(ctx, plan);

  if (isTimedOut(ctx)) {
    verifierLogger.warn(runId, 'Run timed out after completion', { elapsed: elapsedMs(ctx) });
  }

  return { result, aborted: false };
}
