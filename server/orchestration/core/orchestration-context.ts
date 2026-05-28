/**
 * server/orchestration/core/orchestration-context.ts
 *
 * Builds and manages the immutable orchestration context passed throughout
 * the orchestration lifecycle. No side effects, no tool execution.
 */

import type { OrchestrationContext, OrchestrationRequest } from '../types/orchestration.types.ts';
import { newSessionId, now } from '../utils/orchestration-utils.ts';

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildOrchestrationContext(
  req:    OrchestrationRequest,
  signal?: AbortSignal,
): OrchestrationContext {
  return Object.freeze({
    orchestrationId: req.orchestrationId,
    runId:           req.runId,
    projectId:       req.projectId,
    sandboxRoot:     req.sandboxRoot,
    sessionId:       newSessionId(),
    startedAt:       now(),
    signal,
  });
}

// ── Tool execution context bridge ─────────────────────────────────────────────
// Converts an OrchestrationContext into the shape expected by the tool dispatcher.

export function toToolContext(
  ctx:  OrchestrationContext,
  meta: Record<string, unknown> = {},
): {
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
    meta:        { orchestrationId: ctx.orchestrationId, sessionId: ctx.sessionId, ...meta },
  };
}

// ── Per-run context store ─────────────────────────────────────────────────────

const _contextStore = new Map<string, OrchestrationContext>();

export function storeContext(runId: string, ctx: OrchestrationContext): void {
  _contextStore.set(runId, ctx);
}

export function getContext(runId: string): OrchestrationContext | undefined {
  return _contextStore.get(runId);
}

export function clearContext(runId: string): void {
  _contextStore.delete(runId);
}

// ── Context validation guard ──────────────────────────────────────────────────

export function assertContext(ctx: OrchestrationContext | null | undefined): asserts ctx is OrchestrationContext {
  if (!ctx) throw new Error('[orchestration-context] Context is null or undefined');
  if (!ctx.orchestrationId) throw new Error('[orchestration-context] orchestrationId is missing');
  if (!ctx.runId)           throw new Error('[orchestration-context] runId is missing');
  if (!ctx.sessionId)       throw new Error('[orchestration-context] sessionId is missing');
}
