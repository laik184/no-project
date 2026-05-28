/**
 * server/orchestration/lifecycle/lifecycle-manager.ts
 *
 * Controls orchestration lifecycle: valid state transitions and
 * session/state synchronization. Orchestration-only — no tool execution.
 */

import type { OrchestrationStatus, OrchestrationContext } from '../types/orchestration.types.ts';
import { setStatus }                from '../core/orchestration-state.ts';
import { transitionSession }        from '../core/orchestration-session.ts';
import { updateStatus }             from '../monitoring/orchestration-monitor.ts';
import { validateLifecycleTransition } from '../validation/integrity-validator.ts';
import { validateStatusTransition }  from '../validation/orchestration-validator.ts';
import { logOrchestrationStatus }   from '../telemetry/orchestration-logger.ts';

// ── Transition result ─────────────────────────────────────────────────────────

export interface TransitionResult {
  ok:      boolean;
  error?:  string;
  from:    OrchestrationStatus;
  to:      OrchestrationStatus;
}

// ── Lifecycle controller ──────────────────────────────────────────────────────

export function transition(
  ctx:       OrchestrationContext,
  sessionId: string,
  from:      OrchestrationStatus,
  to:        OrchestrationStatus,
): TransitionResult {
  // Double-validation: validator + integrity check
  const validatorCheck  = validateStatusTransition(from, to);
  const integrityCheck  = validateLifecycleTransition(from, to);

  const errors = [
    ...validatorCheck.errors,
    ...integrityCheck.errors,
  ];

  if (errors.length > 0) {
    return { ok: false, error: errors[0], from, to };
  }

  // Apply transition to all state stores atomically
  setStatus(ctx.orchestrationId, to);
  transitionSession(sessionId, to);
  updateStatus(ctx.orchestrationId, to);
  logOrchestrationStatus(ctx.orchestrationId, ctx.runId, to);

  return { ok: true, from, to };
}

// ── Convenience transitions ───────────────────────────────────────────────────

export function startPlanning(
  ctx:       OrchestrationContext,
  sessionId: string,
): TransitionResult {
  return transition(ctx, sessionId, 'idle', 'planning');
}

export function startRunning(
  ctx:       OrchestrationContext,
  sessionId: string,
): TransitionResult {
  return transition(ctx, sessionId, 'planning', 'running');
}

export function markCompleted(
  ctx:       OrchestrationContext,
  sessionId: string,
): TransitionResult {
  return transition(ctx, sessionId, 'running', 'completed');
}

export function markFailed(
  ctx:       OrchestrationContext,
  sessionId: string,
): TransitionResult {
  return transition(ctx, sessionId, 'running', 'failed');
}

export function markEscalated(
  ctx:       OrchestrationContext,
  sessionId: string,
): TransitionResult {
  return transition(ctx, sessionId, 'running', 'escalated');
}

export function markCancelled(
  ctx:       OrchestrationContext,
  sessionId: string,
  from:      OrchestrationStatus,
): TransitionResult {
  return transition(ctx, sessionId, from, 'cancelled');
}

export function resumeFromEscalation(
  ctx:       OrchestrationContext,
  sessionId: string,
): TransitionResult {
  return transition(ctx, sessionId, 'escalated', 'running');
}
