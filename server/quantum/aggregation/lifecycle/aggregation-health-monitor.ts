/**
 * lifecycle/aggregation-health-monitor.ts
 *
 * Monitors streaming aggregation sessions for stalls, timeouts, and
 * excessive conflict rates. Emits health events without modifying state.
 * Single responsibility: health observation only.
 */

import type { StreamingSessionId } from "../contracts/aggregation.types.ts";
import { partialBuffer }          from "../buffers/partial-aggregation-buffer.ts";
import { barrierSummary }         from "../reconciliation/reconciliation-barrier.ts";
import { currentPhase }           from "../streaming/streaming-state-machine.ts";
import { emitAggregationFailed }  from "../telemetry/aggregation-telemetry.ts";

// ── Health record ─────────────────────────────────────────────────────────────

export interface HealthRecord {
  sessionId:     StreamingSessionId;
  runId:         string;
  projectId:     number;
  healthy:       boolean;
  stalled:       boolean;
  conflictRate:  number;
  phase:         string;
  checkedAt:     number;
  warnings:      string[];
}

// ── Monitor store ─────────────────────────────────────────────────────────────

interface MonitorEntry {
  runId:       string;
  projectId:   number;
  registeredAt: number;
  lastArrival:  number;
  stallThresholdMs: number;
  intervalId?: ReturnType<typeof setInterval>;
}

const _entries = new Map<StreamingSessionId, MonitorEntry>();
const STALL_THRESHOLD_MS   = 30_000;  // 30 s without a new path = stall
const CONFLICT_RATE_WARN   = 0.4;     // > 40% conflict rate = warning
const CHECK_INTERVAL_MS    = 10_000;  // check every 10 s

// ── Public API ────────────────────────────────────────────────────────────────

export function registerSession(
  sessionId:    StreamingSessionId,
  runId:        string,
  projectId:    number,
  stallThresholdMs: number = STALL_THRESHOLD_MS,
): void {
  const entry: MonitorEntry = {
    runId,
    projectId,
    registeredAt:    Date.now(),
    lastArrival:     Date.now(),
    stallThresholdMs,
  };

  entry.intervalId = setInterval(() => {
    _check(sessionId);
  }, CHECK_INTERVAL_MS);

  _entries.set(sessionId, entry);
}

export function touchArrival(sessionId: StreamingSessionId): void {
  const e = _entries.get(sessionId);
  if (e) e.lastArrival = Date.now();
}

export function deregisterSession(sessionId: StreamingSessionId): void {
  const e = _entries.get(sessionId);
  if (e?.intervalId) clearInterval(e.intervalId);
  _entries.delete(sessionId);
}

export function getHealth(sessionId: StreamingSessionId): HealthRecord | undefined {
  const entry = _entries.get(sessionId);
  if (!entry) return undefined;
  return _buildRecord(sessionId, entry);
}

// ── Internal check ────────────────────────────────────────────────────────────

function _check(sessionId: StreamingSessionId): void {
  const entry = _entries.get(sessionId);
  if (!entry) return;

  const record = _buildRecord(sessionId, entry);

  if (!record.healthy) {
    emitAggregationFailed(
      sessionId, entry.runId, entry.projectId,
      record.warnings.join("; "), record.phase,
    );
  }
}

function _buildRecord(sessionId: StreamingSessionId, entry: MonitorEntry): HealthRecord {
  const state         = partialBuffer.getState(sessionId);
  const barrier       = barrierSummary(sessionId);
  const phase         = currentPhase(sessionId);
  const warnings: string[] = [];

  const stalled = (Date.now() - entry.lastArrival) > entry.stallThresholdMs &&
                  phase !== "collapsed" && phase !== "failed";
  if (stalled) warnings.push(`Session stalled for >${entry.stallThresholdMs}ms`);

  const total        = state?.arrivedPaths ?? 0;
  const conflictRate = total > 0 ? barrier.total / total : 0;
  if (conflictRate > CONFLICT_RATE_WARN) {
    warnings.push(`High conflict rate: ${(conflictRate * 100).toFixed(0)}%`);
  }

  if (barrier.unresolved > 0 && phase === "collapsing") {
    warnings.push(`${barrier.unresolved} unresolved conflicts during collapse`);
  }

  return {
    sessionId,
    runId:        entry.runId,
    projectId:    entry.projectId,
    healthy:      warnings.length === 0,
    stalled,
    conflictRate,
    phase,
    checkedAt:    Date.now(),
    warnings,
  };
}
