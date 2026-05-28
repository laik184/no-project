/**
 * server/orchestration/monitoring/failure-monitor.ts
 *
 * Tracks orchestration failures, retry attempts, and repeated failure patterns.
 * In-memory only — no tool execution, no filesystem access.
 */

import type { OrchestrationFailure, AgentType } from '../types/orchestration.types.ts';
import { now } from '../utils/orchestration-utils.ts';

// ── Store ─────────────────────────────────────────────────────────────────────

const _failures = new Map<string, OrchestrationFailure[]>();

// ── Recording ─────────────────────────────────────────────────────────────────

export function recordFailure(
  orchestrationId: string,
  runId:           string,
  error:           string,
  retryCount:      number,
  phaseId?:        string,
  workflowId?:     string,
  agentType?:      AgentType,
): void {
  const entry: OrchestrationFailure = {
    orchestrationId,
    runId,
    error,
    retryCount,
    phaseId,
    workflowId,
    agentType,
    timestamp: now(),
  };

  const list = _failures.get(runId) ?? [];
  list.push(entry);
  _failures.set(runId, list);
}

// ── Read API ──────────────────────────────────────────────────────────────────

export function getFailures(runId: string): OrchestrationFailure[] {
  return _failures.get(runId) ?? [];
}

export function getFailureCount(runId: string): number {
  return (_failures.get(runId) ?? []).length;
}

export function getRecentFailures(runId: string, limit: number = 5): OrchestrationFailure[] {
  const all = _failures.get(runId) ?? [];
  return all.slice(-limit);
}

export function hasRepeatedFailures(
  runId:     string,
  phaseId:   string,
  threshold: number = 3,
): boolean {
  const all = _failures.get(runId) ?? [];
  return all.filter(f => f.phaseId === phaseId).length >= threshold;
}

export function summarize(runId: string): {
  total:     number;
  byPhase:   Record<string, number>;
  byAgent:   Record<string, number>;
  recentErr: string | undefined;
} {
  const all = _failures.get(runId) ?? [];

  const byPhase: Record<string, number> = {};
  const byAgent: Record<string, number> = {};

  for (const f of all) {
    if (f.phaseId)    byPhase[f.phaseId] = (byPhase[f.phaseId] ?? 0) + 1;
    if (f.agentType)  byAgent[f.agentType] = (byAgent[f.agentType] ?? 0) + 1;
  }

  return {
    total:     all.length,
    byPhase,
    byAgent,
    recentErr: all.at(-1)?.error,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearFailures(runId: string): void {
  _failures.delete(runId);
}

export function allRunIds(): string[] {
  return Array.from(_failures.keys());
}
