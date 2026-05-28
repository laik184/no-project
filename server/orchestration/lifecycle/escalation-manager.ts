/**
 * server/orchestration/lifecycle/escalation-manager.ts
 *
 * Manages escalation decisions and records for the orchestration layer.
 * Determines when to escalate, logs it, and publishes the event.
 * Orchestration-only — no tool execution, no filesystem access.
 */

import type { EscalationRecord, OrchestrationContext } from '../types/orchestration.types.ts';
import { recordFailure, getFailureCount }  from '../monitoring/failure-monitor.ts';
import { recordEscalation }               from '../telemetry/orchestration-metrics.ts';
import { logEscalationTriggered }         from '../telemetry/orchestration-logger.ts';
import { publishEscalationTriggered }     from '../events/event-publisher.ts';
import { incrementEscalation }            from '../core/orchestration-state.ts';
import { now }                            from '../utils/orchestration-utils.ts';

// ── Thresholds ────────────────────────────────────────────────────────────────

const DEFAULT_ESCALATION_THRESHOLD = 3;

// ── Escalation store ──────────────────────────────────────────────────────────

const _escalations = new Map<string, EscalationRecord[]>();

// ── Decision ──────────────────────────────────────────────────────────────────

export function shouldEscalate(
  runId:     string,
  threshold: number = DEFAULT_ESCALATION_THRESHOLD,
): boolean {
  return getFailureCount(runId) >= threshold;
}

// ── Trigger ───────────────────────────────────────────────────────────────────

export function triggerEscalation(
  ctx:    OrchestrationContext,
  reason: string,
): EscalationRecord {
  const failureCount = getFailureCount(ctx.runId);

  const record: EscalationRecord = {
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    reason,
    failureCount,
    escalatedAt:     now(),
  };

  const list = _escalations.get(ctx.runId) ?? [];
  list.push(record);
  _escalations.set(ctx.runId, list);

  incrementEscalation(ctx.orchestrationId);
  recordEscalation(ctx.runId);
  logEscalationTriggered(ctx.orchestrationId, ctx.runId, reason, failureCount);
  publishEscalationTriggered(record);

  return record;
}

// ── Read API ──────────────────────────────────────────────────────────────────

export function getEscalations(runId: string): EscalationRecord[] {
  return _escalations.get(runId) ?? [];
}

export function getEscalationCount(runId: string): number {
  return (_escalations.get(runId) ?? []).length;
}

export function hasEscalated(runId: string): boolean {
  return getEscalationCount(runId) > 0;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearEscalations(runId: string): void {
  _escalations.delete(runId);
}
