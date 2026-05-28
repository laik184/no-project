/**
 * server/agents/filesystem/core/filesystem-context.ts
 *
 * Builds and validates the FilesystemExecutionContext for each agent run.
 * No filesystem access — context is a plain data structure.
 */

import type { FilesystemExecutionContext } from '../types/filesystem.types.ts';
import { generateSessionId }               from '../utils/filesystem-utils.ts';

// ── Context input ─────────────────────────────────────────────────────────────

export interface FilesystemContextInput {
  runId:        string;
  projectId:    string;
  sandboxRoot:  string;
  sessionId?:   string;
  signal?:      AbortSignal;
}

// ── Validation error ──────────────────────────────────────────────────────────

export class FilesystemContextError extends Error {
  constructor(message: string) {
    super(`[filesystem-context] ${message}`);
    this.name = 'FilesystemContextError';
  }
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildContext(input: FilesystemContextInput): FilesystemExecutionContext {
  if (!input.runId?.trim()) {
    throw new FilesystemContextError('runId is required and must be a non-empty string.');
  }
  if (!input.projectId?.trim()) {
    throw new FilesystemContextError('projectId is required and must be a non-empty string.');
  }
  if (!input.sandboxRoot?.trim()) {
    throw new FilesystemContextError('sandboxRoot is required and must be a non-empty string.');
  }

  return Object.freeze({
    runId:       input.runId.trim(),
    projectId:   input.projectId.trim(),
    sandboxRoot: input.sandboxRoot.trim(),
    sessionId:   input.sessionId ?? generateSessionId(),
    signal:      input.signal,
  });
}

// ── Context → ToolExecutionContext adapter ────────────────────────────────────
// The central dispatcher expects a ToolExecutionContext — this maps cleanly.

export function toToolContext(ctx: FilesystemExecutionContext): {
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
    meta:        { sessionId: ctx.sessionId, agent: 'filesystem' },
  };
}
