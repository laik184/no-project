/**
 * server/agents/verifier/core/verifier-context.ts
 * Immutable execution context passed through the verifier agent pipeline.
 */

import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import type { VerificationPhase }    from '../types/verifier.types.ts';

export interface VerifierExecutionContext {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly phases:      ReadonlyArray<VerificationPhase>;
  readonly port?:       number;
  readonly timeoutMs:   number;
  readonly signal?:     AbortSignal;
  readonly toolCtx:     ToolExecutionContext;
}

export function buildVerifierContext(
  runId:       string,
  projectId:   string,
  phases:      VerificationPhase[],
  sandboxRoot  = process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
  port?:       number,
  timeoutMs    = 120_000,
  signal?:     AbortSignal,
): VerifierExecutionContext {
  const toolCtx: ToolExecutionContext = Object.freeze({
    runId, projectId, sandboxRoot, meta: {}, signal,
  });
  return Object.freeze({
    runId, projectId, sandboxRoot,
    phases:    Object.freeze([...phases]),
    port, timeoutMs, signal, toolCtx,
  });
}
