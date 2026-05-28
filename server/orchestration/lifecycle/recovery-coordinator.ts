/**
 * server/orchestration/lifecycle/recovery-coordinator.ts
 *
 * Coordinates recovery flow when an orchestration enters a failed/escalated state.
 * Determines recovery strategy and communicates recovery intent via events.
 * Orchestration-only — no tool execution, no filesystem access.
 */

import type { OrchestrationContext, DecisionResult, OrchestrationFailure } from '../types/orchestration.types.ts';
import { getFailures, getFailureCount }   from '../monitoring/failure-monitor.ts';
import { logRecoveryStarted, logRecoveryCompleted } from '../telemetry/orchestration-logger.ts';
import { publishRecoveryStarted }         from '../events/event-publisher.ts';
import { now }                            from '../utils/orchestration-utils.ts';

// ── Recovery strategies ───────────────────────────────────────────────────────

export type RecoveryStrategy =
  | 'retry_last_phase'
  | 'skip_failed_phase'
  | 'restart_workflow'
  | 'abort';

// ── Recovery plan ─────────────────────────────────────────────────────────────

export interface RecoveryPlan {
  strategy:     RecoveryStrategy;
  reason:       string;
  phaseId?:     string;
  workflowId?:  string;
  createdAt:    Date;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _plans = new Map<string, RecoveryPlan[]>();

// ── Strategy resolver ─────────────────────────────────────────────────────────

export function resolveRecoveryStrategy(
  ctx:        OrchestrationContext,
  maxRetries: number = 3,
): RecoveryPlan {
  const failures    = getFailures(ctx.runId);
  const failCount   = getFailureCount(ctx.runId);
  const lastFailure = failures.at(-1);

  let strategy: RecoveryStrategy;
  let reason:   string;

  if (failCount > maxRetries * 2) {
    strategy = 'abort';
    reason   = `Exceeded maximum recovery attempts (${failCount} failures)`;
  } else if (lastFailure?.retryCount !== undefined && lastFailure.retryCount >= maxRetries) {
    strategy = 'skip_failed_phase';
    reason   = `Phase retry limit reached (${lastFailure.retryCount} attempts) — skipping`;
  } else if (failCount <= maxRetries) {
    strategy = 'retry_last_phase';
    reason   = `Failure count (${failCount}) within retry budget — retrying last failed phase`;
  } else {
    strategy = 'restart_workflow';
    reason   = `Multiple failures across phases — restarting workflow`;
  }

  return {
    strategy,
    reason,
    phaseId:    lastFailure?.phaseId,
    workflowId: lastFailure?.workflowId,
    createdAt:  now(),
  };
}

// ── Recovery lifecycle ────────────────────────────────────────────────────────

export function initiateRecovery(
  ctx:    OrchestrationContext,
  reason: string,
): RecoveryPlan {
  logRecoveryStarted(ctx.orchestrationId, ctx.runId, reason);
  publishRecoveryStarted(ctx, reason);

  const plan = resolveRecoveryStrategy(ctx);

  const list = _plans.get(ctx.runId) ?? [];
  list.push(plan);
  _plans.set(ctx.runId, list);

  return plan;
}

export function completeRecovery(ctx: OrchestrationContext): void {
  logRecoveryCompleted(ctx.orchestrationId, ctx.runId);
}

// ── Decision bridge ───────────────────────────────────────────────────────────

export function recoveryPlanToDecision(plan: RecoveryPlan): DecisionResult {
  switch (plan.strategy) {
    case 'retry_last_phase':
      return { outcome: 'retry',   reason: plan.reason, nextPhaseId: plan.phaseId };
    case 'skip_failed_phase':
      return { outcome: 'skip',    reason: plan.reason, nextPhaseId: plan.phaseId };
    case 'restart_workflow':
      return { outcome: 'retry',   reason: plan.reason };
    case 'abort':
      return { outcome: 'abort',   reason: plan.reason };
  }
}

// ── Read API ──────────────────────────────────────────────────────────────────

export function getRecoveryPlans(runId: string): RecoveryPlan[] {
  return _plans.get(runId) ?? [];
}

export function getLastRecoveryPlan(runId: string): RecoveryPlan | undefined {
  return (_plans.get(runId) ?? []).at(-1);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearRecoveryPlans(runId: string): void {
  _plans.delete(runId);
}
