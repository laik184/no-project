/**
 * orchestration-context.ts
 *
 * Execution context propagation for the orchestration layer.
 * Each run owns an immutable context that flows through all phases.
 * Context is snapshotted at checkpoints for replay safety.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  OrchestrationContext,
  OrchestrationMode,
} from "./orchestration-types.ts";

// ── Context Store ─────────────────────────────────────────────────────────────

const _contexts = new Map<string, OrchestrationContext>();

// ── Factory ───────────────────────────────────────────────────────────────────

export function createContext(opts: {
  runId:        string;
  projectId:    number;
  goal:         string;
  mode:         OrchestrationMode;
  sessionId?:   string;
  parentRunId?: string;
  maxSteps?:    number;
  maxRetries?:  number;
  metadata?:    Record<string, unknown>;
}): OrchestrationContext {
  const ctx: OrchestrationContext = {
    runId:       opts.runId,
    projectId:   opts.projectId,
    goal:        opts.goal,
    mode:        opts.mode,
    sessionId:   opts.sessionId,
    traceId:     uuidv4(),
    parentRunId: opts.parentRunId,
    maxSteps:    opts.maxSteps ?? 25,
    maxRetries:  opts.maxRetries ?? 3,
    replaySafe:  true,
    metadata:    opts.metadata ?? {},
    startedAt:   Date.now(),
  };
  _contexts.set(opts.runId, ctx);
  return ctx;
}

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getContext(runId: string): OrchestrationContext | undefined {
  return _contexts.get(runId);
}

export function requireContext(runId: string): OrchestrationContext {
  const ctx = _contexts.get(runId);
  if (!ctx) throw new Error(`[orchestration-context] No context for runId=${runId}`);
  return ctx;
}

export function enrichContext(
  runId: string,
  patch: Partial<Pick<OrchestrationContext, "metadata" | "maxSteps" | "maxRetries" | "replaySafe">>,
): void {
  const ctx = _contexts.get(runId);
  if (!ctx) return;
  if (patch.metadata)    Object.assign(ctx.metadata, patch.metadata);
  if (patch.maxSteps    !== undefined) ctx.maxSteps    = patch.maxSteps;
  if (patch.maxRetries  !== undefined) ctx.maxRetries  = patch.maxRetries;
  if (patch.replaySafe  !== undefined) ctx.replaySafe  = patch.replaySafe;
}

export function snapshotContext(runId: string): Partial<OrchestrationContext> {
  const ctx = _contexts.get(runId);
  if (!ctx) return {};
  return { ...ctx, metadata: { ...ctx.metadata } };
}

export function clearContext(runId: string): void {
  _contexts.delete(runId);
}

// ── Child context (for sub-runs) ──────────────────────────────────────────────

export function forkContext(
  parentRunId: string,
  childRunId:  string,
  overrides?:  Partial<Pick<OrchestrationContext, "goal" | "mode" | "maxSteps">>,
): OrchestrationContext | undefined {
  const parent = _contexts.get(parentRunId);
  if (!parent) return undefined;

  const child: OrchestrationContext = {
    ...parent,
    runId:       childRunId,
    traceId:     uuidv4(),
    parentRunId: parentRunId,
    startedAt:   Date.now(),
    metadata:    { ...parent.metadata, forkedFrom: parentRunId },
    ...overrides,
  };
  _contexts.set(childRunId, child);
  return child;
}

// ── Context diagnostics ───────────────────────────────────────────────────────

export function listActiveContexts(): string[] {
  return Array.from(_contexts.keys());
}

export function contextCount(): number {
  return _contexts.size;
}
