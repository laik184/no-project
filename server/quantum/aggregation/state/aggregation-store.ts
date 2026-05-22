/**
 * aggregation-store.ts
 *
 * In-memory singleton store: Map<runId, AggregationSession[]>
 * Scoped by runId; each wave produces one session entry.
 *
 * TTL eviction prevents unbounded memory growth across long runs.
 */

import { createSession } from "./aggregation-session.ts";
import type { AggregationSession } from "./aggregation-session.ts";
import { v4 as uuidv4 } from "uuid";

// ── Store ─────────────────────────────────────────────────────────────────────

const _store = new Map<string, AggregationSession[]>();  // runId → sessions[]

const SESSION_TTL_MS  = 10 * 60 * 1_000;  // 10 min
const MAX_RUNS_STORED = 500;

// ── Public API ────────────────────────────────────────────────────────────────

/** Open a new session for a specific (runId, waveIndex). */
export function openSession(
  runId:     string,
  projectId: number,
  waveIndex: number,
): AggregationSession {
  _evictStaleRuns();

  const executionId = uuidv4();
  const session     = createSession(runId, projectId, waveIndex, executionId);

  if (!_store.has(runId)) _store.set(runId, []);
  _store.get(runId)!.push(session);

  return session;
}

/** Get the active (most recent) session for a runId+waveIndex. */
export function getSession(runId: string, waveIndex: number): AggregationSession | undefined {
  const sessions = _store.get(runId);
  if (!sessions) return undefined;
  return [...sessions].reverse().find(s => s.waveIndex === waveIndex);
}

/** Get all sessions for a run, ordered oldest-first. */
export function getRunSessions(runId: string): AggregationSession[] {
  return _store.get(runId) ?? [];
}

/** Remove all sessions for a completed/cancelled run. */
export function clearRun(runId: string): void {
  _store.delete(runId);
}

/** Snapshot of current store size for diagnostics. */
export function storeStats(): { runs: number; totalSessions: number } {
  let totalSessions = 0;
  for (const sessions of _store.values()) totalSessions += sessions.length;
  return { runs: _store.size, totalSessions };
}

// ── TTL eviction ───────────────────────────────────────────────────────────────

function _evictStaleRuns(): void {
  if (_store.size < MAX_RUNS_STORED) return;

  const now    = Date.now();
  const cutoff = now - SESSION_TTL_MS;

  for (const [runId, sessions] of _store) {
    const lastUpdated = Math.max(...sessions.map(s => s.updatedAt));
    if (lastUpdated < cutoff) {
      _store.delete(runId);
    }
  }
}
