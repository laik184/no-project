/**
 * core/verifier-context.ts
 * Immutable execution context for a single verification run.
 */

import type { VerificationInput, VerificationConfig } from '../types/verifier.types.ts';
import { DEFAULT_VERIFICATION_CONFIG } from '../types/verifier.types.ts';
import { buildContext } from '../coordination/dispatcher-client.ts';
import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';

export interface VerifierContext {
  readonly input:       VerificationInput;
  readonly config:      VerificationConfig;
  readonly toolContext: ToolExecutionContext;
  readonly startedAt:   Date;
}

export function createVerifierContext(
  input:   VerificationInput,
  config?: Partial<VerificationConfig>,
): VerifierContext {
  const mergedConfig: VerificationConfig = { ...DEFAULT_VERIFICATION_CONFIG, ...config };

  const toolContext = buildContext(
    input.runId,
    input.projectId,
    input.sandboxRoot,
    {
      phases:    input.phases,
      port:      input.port,
      timeoutMs: input.timeoutMs,
    },
    input.abortSignal,
  );

  return {
    input,
    config:    mergedConfig,
    toolContext,
    startedAt: new Date(),
  };
}

export function contextWith(
  ctx:   VerifierContext,
  patch: Partial<Pick<VerificationConfig, 'maxRetries' | 'phaseTimeoutMs' | 'stopOnFailure'>>,
): VerifierContext {
  return { ...ctx, config: { ...ctx.config, ...patch } };
}

export function elapsedMs(ctx: VerifierContext): number {
  return Date.now() - ctx.startedAt.getTime();
}

export function isTimedOut(ctx: VerifierContext): boolean {
  const timeout = ctx.input.timeoutMs ?? 300_000;
  return elapsedMs(ctx) > timeout;
}
