/**
 * aggregation-session.ts
 *
 * Represents a single active aggregation run scoped to one (runId, waveIndex) pair.
 * Holds all agent results collected during a wave before they are merged.
 */

import type {
  AgentResult, MergeConflict, CollapsedExecutionState, AggregationStatus,
} from "../aggregation-types.ts";

export interface AggregationSession {
  readonly runId:       string;
  readonly projectId:   number;
  readonly waveIndex:   number;
  readonly executionId: string;
  readonly createdAt:   number;

  status:          AggregationStatus;
  results:         Map<string, AgentResult>;   // nodeId → AgentResult
  conflicts:       MergeConflict[];
  collapsedState:  CollapsedExecutionState | null;
  spanId:          string | null;
  updatedAt:       number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSession(
  runId:       string,
  projectId:   number,
  waveIndex:   number,
  executionId: string,
): AggregationSession {
  return {
    runId,
    projectId,
    waveIndex,
    executionId,
    createdAt:      Date.now(),
    status:         "collecting",
    results:        new Map(),
    conflicts:      [],
    collapsedState: null,
    spanId:         null,
    updatedAt:      Date.now(),
  };
}

// ── Accessors ─────────────────────────────────────────────────────────────────

export function addResult(session: AggregationSession, result: AgentResult): void {
  session.results.set(result.nodeId, result);
  session.updatedAt = Date.now();
}

export function addConflict(session: AggregationSession, conflict: MergeConflict): void {
  session.conflicts.push(conflict);
  session.updatedAt = Date.now();
}

export function setStatus(session: AggregationSession, status: AggregationStatus): void {
  session.status    = status;
  session.updatedAt = Date.now();
}

export function setCollapsedState(session: AggregationSession, state: CollapsedExecutionState): void {
  session.collapsedState = state;
  session.status         = "collapsed";
  session.updatedAt      = Date.now();
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getSuccessfulResults(session: AggregationSession): AgentResult[] {
  return [...session.results.values()].filter(r => r.success);
}

export function getFailedResults(session: AggregationSession): AgentResult[] {
  return [...session.results.values()].filter(r => !r.success);
}

export function hasUnresolvedConflicts(session: AggregationSession): boolean {
  return session.conflicts.some(c => !c.resolved);
}

export function unresolvedCount(session: AggregationSession): number {
  return session.conflicts.filter(c => !c.resolved).length;
}

export function resolvedCount(session: AggregationSession): number {
  return session.conflicts.filter(c => c.resolved).length;
}
