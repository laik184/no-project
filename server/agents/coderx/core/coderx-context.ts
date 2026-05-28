/**
 * server/agents/coderx/core/coderx-context.ts
 *
 * Builds and validates the CoderXExecutionContext for each agent run.
 * No execution logic — context is a plain immutable data structure.
 */

import type { CoderXExecutionContext } from '../types/coderx.types.ts';
import { generateSessionId }           from '../utils/coding-utils.ts';

export interface CoderXContextInput {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  requestId:   string;
  sessionId?:  string;
  signal?:     AbortSignal;
}

export class CoderXContextError extends Error {
  constructor(message: string) {
    super(`[coderx-context] ${message}`);
    this.name = 'CoderXContextError';
  }
}

export function buildCoderXContext(input: CoderXContextInput): CoderXExecutionContext {
  if (!input.runId?.trim())       throw new CoderXContextError('runId is required.');
  if (!input.projectId?.trim())   throw new CoderXContextError('projectId is required.');
  if (!input.sandboxRoot?.trim()) throw new CoderXContextError('sandboxRoot is required.');
  if (!input.requestId?.trim())   throw new CoderXContextError('requestId is required.');

  return Object.freeze({
    runId:       input.runId.trim(),
    projectId:   input.projectId.trim(),
    sandboxRoot: input.sandboxRoot.trim(),
    requestId:   input.requestId.trim(),
    sessionId:   input.sessionId ?? generateSessionId(),
    signal:      input.signal,
  });
}

/** Map CoderXExecutionContext → ToolExecutionContext shape expected by the dispatcher. */
export function toToolContext(ctx: CoderXExecutionContext): {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  signal?:     AbortSignal;
  meta:        Record<string, unknown>;
} {
  return {
    runId:       ctx.runId,
    projectId:   ctx.projectId,
    sandboxRoot: ctx.sandboxRoot,
    signal:      ctx.signal,
    meta:        { sessionId: ctx.sessionId, requestId: ctx.requestId, agent: 'coderx' },
  };
}
