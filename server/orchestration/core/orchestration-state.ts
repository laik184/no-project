/**
 * server/orchestration/core/orchestration-state.ts
 *
 * Per-orchestration runtime state store.
 * Manages mutable orchestration state across the lifecycle.
 * In-memory only — no tool execution, no filesystem access.
 */

import type { OrchestrationStatus } from '../types/orchestration.types.ts';
import { now } from '../utils/orchestration-utils.ts';

// ── Runtime state entry ───────────────────────────────────────────────────────

interface OrchestrationState {
  orchestrationId:  string;
  runId:            string;
  status:           OrchestrationStatus;
  currentWorkflowId?: string;
  currentPhaseId?:    string;
  retryCount:       number;
  escalationCount:  number;
  startedAt:        Date;
  lastUpdatedAt:    Date;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _states = new Map<string, OrchestrationState>();

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function initState(orchestrationId: string, runId: string): void {
  _states.set(orchestrationId, {
    orchestrationId,
    runId,
    status:         'idle',
    retryCount:     0,
    escalationCount: 0,
    startedAt:      now(),
    lastUpdatedAt:  now(),
  });
}

export function setStatus(
  orchestrationId: string,
  status:          OrchestrationStatus,
): void {
  const s = _states.get(orchestrationId);
  if (!s) return;
  s.status        = status;
  s.lastUpdatedAt = now();
}

export function setCurrentWorkflow(
  orchestrationId: string,
  workflowId:      string | undefined,
): void {
  const s = _states.get(orchestrationId);
  if (!s) return;
  s.currentWorkflowId = workflowId;
  s.currentPhaseId    = undefined;
  s.lastUpdatedAt     = now();
}

export function setCurrentPhase(
  orchestrationId: string,
  phaseId:         string | undefined,
): void {
  const s = _states.get(orchestrationId);
  if (!s) return;
  s.currentPhaseId = phaseId;
  s.lastUpdatedAt  = now();
}

export function incrementRetry(orchestrationId: string): number {
  const s = _states.get(orchestrationId);
  if (!s) return 0;
  s.retryCount++;
  s.lastUpdatedAt = now();
  return s.retryCount;
}

export function incrementEscalation(orchestrationId: string): number {
  const s = _states.get(orchestrationId);
  if (!s) return 0;
  s.escalationCount++;
  s.lastUpdatedAt = now();
  return s.escalationCount;
}

// ── Read API ──────────────────────────────────────────────────────────────────

export function getState(orchestrationId: string): OrchestrationState | undefined {
  return _states.get(orchestrationId);
}

export function getStatus(orchestrationId: string): OrchestrationStatus | undefined {
  return _states.get(orchestrationId)?.status;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function destroyState(orchestrationId: string): void {
  _states.delete(orchestrationId);
}

export function allOrchestrationIds(): string[] {
  return Array.from(_states.keys());
}
