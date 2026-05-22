/**
 * retry-intelligence.ts
 *
 * Confidence-aware retry decision engine.
 * Higher-confidence agents get more retry budget.
 * Repeated identical failures are hard-blocked.
 * Emits telemetry on every decision.
 */

import type { ConfidenceRetryDecision } from "./confidence-types.ts";
import { RETRY } from "./confidence-thresholds.ts";
import { getConfidenceState, getConfidence } from "./stores/confidence-store.ts";
import { emitRetryAllowed, emitRetryDenied } from "./confidence-events.ts";

// ── Per-run failure fingerprint tracker ──────────────────────────────────────

const _failureFingerprints = new Map<string, Map<string, number>>();

function _trackFailure(runId: string, fingerprint: string): number {
  if (!_failureFingerprints.has(runId)) {
    _failureFingerprints.set(runId, new Map());
  }
  const map   = _failureFingerprints.get(runId)!;
  const count = (map.get(fingerprint) ?? 0) + 1;
  map.set(fingerprint, count);
  return count;
}

export function clearRunFingerprints(runId: string): void {
  _failureFingerprints.delete(runId);
}

// ── Max retries by state ──────────────────────────────────────────────────────

function _maxRetriesForAgent(agentId: string): number {
  const state = getConfidenceState(agentId);
  switch (state) {
    case "TRUSTED":    return RETRY.MAX_FOR_TRUSTED;
    case "STABLE":     return RETRY.MAX_FOR_STABLE;
    case "DEGRADED":   return RETRY.MAX_FOR_DEGRADED;
    case "UNRELIABLE": return RETRY.MAX_FOR_UNRELIABLE;
    case "BLOCKED":    return RETRY.MAX_FOR_BLOCKED;
  }
}

// ── Exponential backoff ────────────────────────────────────────────────────────

function _computeBackoff(attempt: number): number {
  const raw = RETRY.BASE_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(raw, RETRY.MAX_BACKOFF_MS);
}

// ── Main decision function ────────────────────────────────────────────────────

export interface RetryIntelligenceInput {
  agentId:          string;
  runId:            string;
  attemptsSoFar:    number;
  failureClass:     string;   // e.g. "DEPENDENCY_FAILURE", "RUNTIME_CRASH"
  failureDetail:    string;
  isNonRetryable?:  boolean;
}

export function decideRetry(input: RetryIntelligenceInput): ConfidenceRetryDecision {
  const { agentId, runId, attemptsSoFar, failureClass, failureDetail, isNonRetryable } = input;

  // Hard gate: non-retryable failures
  if (isNonRetryable) {
    const decision: ConfidenceRetryDecision = {
      agentId, runId, allowed: false,
      reason:        `Non-retryable failure class: ${failureClass}`,
      maxRetriesLeft: 0,
      backoffMs:      0,
    };
    emitRetryDenied(decision);
    return decision;
  }

  // Hard gate: blocked agent
  const record = getConfidence(agentId);
  if (!record || record.state === "BLOCKED") {
    const decision: ConfidenceRetryDecision = {
      agentId, runId, allowed: false,
      reason:        "Agent is BLOCKED — no retries allowed",
      maxRetriesLeft: 0,
      backoffMs:      0,
    };
    emitRetryDenied(decision);
    return decision;
  }

  // Track identical failure fingerprint (class + truncated detail)
  const fingerprint    = `${failureClass}::${failureDetail.slice(0, 60)}`;
  const repeatCount    = _trackFailure(runId, fingerprint);

  if (repeatCount >= RETRY.SAME_FAILURE_BLOCK) {
    const decision: ConfidenceRetryDecision = {
      agentId, runId, allowed: false,
      reason:        `Same failure repeated ${repeatCount}x — retry blocked to prevent loop`,
      maxRetriesLeft: 0,
      backoffMs:      0,
    };
    emitRetryDenied(decision);
    return decision;
  }

  // Budget check
  const maxRetries = _maxRetriesForAgent(agentId);
  if (attemptsSoFar >= maxRetries) {
    const decision: ConfidenceRetryDecision = {
      agentId, runId, allowed: false,
      reason:        `Retry budget exhausted (${attemptsSoFar}/${maxRetries}) for state ${record.state}`,
      maxRetriesLeft: 0,
      backoffMs:      0,
    };
    emitRetryDenied(decision);
    return decision;
  }

  const decision: ConfidenceRetryDecision = {
    agentId, runId, allowed: true,
    reason:        `Retry ${attemptsSoFar + 1}/${maxRetries} allowed for ${record.state} agent`,
    maxRetriesLeft: maxRetries - attemptsSoFar - 1,
    backoffMs:      _computeBackoff(attemptsSoFar),
  };
  emitRetryAllowed(decision);
  return decision;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getRemainingRetries(agentId: string, attemptsSoFar: number): number {
  return Math.max(0, _maxRetriesForAgent(agentId) - attemptsSoFar);
}

export function canAgentRetry(agentId: string, attemptsSoFar: number): boolean {
  return attemptsSoFar < _maxRetriesForAgent(agentId) &&
         getConfidenceState(agentId) !== "BLOCKED";
}
