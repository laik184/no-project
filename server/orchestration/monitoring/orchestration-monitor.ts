/**
 * server/orchestration/monitoring/orchestration-monitor.ts
 *
 * Tracks active orchestration state, workflow progress, and stuck loops.
 * In-memory only — no tool execution, no filesystem access.
 */

import type { OrchestrationSnapshot, OrchestrationStatus } from '../types/orchestration.types.ts';
import { progressPct, isStuck, now } from '../utils/orchestration-utils.ts';

// ── Active orchestration entry ────────────────────────────────────────────────

interface ActiveEntry {
  orchestrationId:  string;
  sessionId:        string;
  runId:            string;
  status:           OrchestrationStatus;
  workflowsTotal:   number;
  workflowsDone:    number;
  activeWorkflowId?: string;
  activePhaseId?:    string;
  startedAt:        Date;
  lastActivityAt:   Date;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _active = new Map<string, ActiveEntry>();

// ── Registration ──────────────────────────────────────────────────────────────

export function registerOrchestration(
  orchestrationId: string,
  sessionId:       string,
  runId:           string,
  workflowsTotal:  number,
): void {
  _active.set(orchestrationId, {
    orchestrationId,
    sessionId,
    runId,
    status:         'planning',
    workflowsTotal,
    workflowsDone:  0,
    startedAt:      now(),
    lastActivityAt: now(),
  });
}

export function unregisterOrchestration(orchestrationId: string): void {
  _active.delete(orchestrationId);
}

// ── State updates ─────────────────────────────────────────────────────────────

export function updateStatus(
  orchestrationId: string,
  status:          OrchestrationStatus,
): void {
  const e = _active.get(orchestrationId);
  if (!e) return;
  e.status         = status;
  e.lastActivityAt = now();
}

export function setActiveWorkflow(
  orchestrationId: string,
  workflowId:      string,
): void {
  const e = _active.get(orchestrationId);
  if (!e) return;
  e.activeWorkflowId = workflowId;
  e.activePhaseId    = undefined;
  e.lastActivityAt   = now();
}

export function setActivePhase(
  orchestrationId: string,
  phaseId:         string,
): void {
  const e = _active.get(orchestrationId);
  if (!e) return;
  e.activePhaseId  = phaseId;
  e.lastActivityAt = now();
}

export function recordWorkflowDone(orchestrationId: string): void {
  const e = _active.get(orchestrationId);
  if (!e) return;
  e.workflowsDone++;
  e.activeWorkflowId = undefined;
  e.activePhaseId    = undefined;
  e.lastActivityAt   = now();
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

export function snapshot(orchestrationId: string): OrchestrationSnapshot | null {
  const e = _active.get(orchestrationId);
  if (!e) return null;

  const stuck = isStuck(e.lastActivityAt, 120_000)
    ? e.lastActivityAt
    : undefined;

  return {
    orchestrationId:   e.orchestrationId,
    sessionId:         e.sessionId,
    status:            e.status,
    workflowsTotal:    e.workflowsTotal,
    workflowsDone:     e.workflowsDone,
    activeWorkflowId:  e.activeWorkflowId,
    activePhaseId:     e.activePhaseId,
    progressPct:       progressPct(e.workflowsDone, e.workflowsTotal),
    stuckSince:        stuck,
  };
}

export function allSnapshots(): OrchestrationSnapshot[] {
  const results: OrchestrationSnapshot[] = [];
  for (const id of _active.keys()) {
    const snap = snapshot(id);
    if (snap) results.push(snap);
  }
  return results;
}

// ── Stuck detection ───────────────────────────────────────────────────────────

export function getStuckOrchestrations(thresholdMs: number = 120_000): OrchestrationSnapshot[] {
  return allSnapshots().filter(s => {
    const e = _active.get(s.orchestrationId);
    return e ? isStuck(e.lastActivityAt, thresholdMs) : false;
  });
}

export function activeCount(): number {
  return _active.size;
}
