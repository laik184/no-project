/**
 * server/agents/executor/core/executor-context.ts
 *
 * Builds and validates the ExecutorExecutionContext for each agent run.
 * No execution logic — context is a plain immutable data structure.
 */

import type { ExecutorExecutionContext } from '../types/executor.types.ts';
import { generateSessionId }             from '../utils/execution-utils.ts';

export interface ExecutorContextInput {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  sessionId?:  string;
  signal?:     AbortSignal;
}

export class ExecutorContextError extends Error {
  constructor(message: string) {
    super(`[executor-context] ${message}`);
    this.name = 'ExecutorContextError';
  }
}

export function buildExecutorContext(input: ExecutorContextInput): ExecutorExecutionContext {
  if (!input.runId?.trim())       throw new ExecutorContextError('runId is required.');
  if (!input.projectId?.trim())   throw new ExecutorContextError('projectId is required.');
  if (!input.sandboxRoot?.trim()) throw new ExecutorContextError('sandboxRoot is required.');

  return Object.freeze({
    runId:       input.runId.trim(),
    projectId:   input.projectId.trim(),
    sandboxRoot: input.sandboxRoot.trim(),
    sessionId:   input.sessionId ?? generateSessionId(),
    signal:      input.signal,
  });
}

/** Map ExecutorExecutionContext → ToolExecutionContext shape expected by the dispatcher. */
export function toToolContext(ctx: ExecutorExecutionContext): {
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
    meta:        { sessionId: ctx.sessionId, agent: 'executor' },
  };
}
