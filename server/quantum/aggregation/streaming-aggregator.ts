/**
 * server/quantum/aggregation/streaming-aggregator.ts
 *
 * StreamingAggregator — progressive result collapse as quantum paths complete.
 *
 * Unlike the batch ResultAggregator (which waits for ALL paths before merging),
 * the StreamingAggregator:
 *   1. Accepts path results as they arrive (event-driven)
 *   2. Runs partial confidence scoring incrementally
 *   3. Emits frontend updates after each arrival
 *   4. Performs early collapse if a path exceeds the confidence threshold
 *   5. Performs final collapse when all paths complete OR timeout fires
 *
 * This reduces end-to-end latency: the frontend sees progress immediately
 * and the winning path is often known before slower paths finish.
 *
 * Single responsibility: streaming aggregation only. No execution, no I/O.
 */

import { bus }                                    from "../../infrastructure/events/bus.ts";
import { rankPaths, findMergeGroups }             from "./confidence-scorer.ts";
import { recordPathResult, getAllResults }         from "./result-aggregator.ts";
import type { PathResult, ExecutionPath }         from "../types/path.types.ts";
import type { AggregatedResult }                  from "../types/quantum.types.ts";
import { incrementCounter }                       from "../../orchestration/telemetry/metrics.ts";

// ── Configuration ─────────────────────────────────────────────────────────────

const EARLY_COLLAPSE_THRESHOLD = 0.92;   // collapse immediately if any path scores > 92%
const DEFAULT_TIMEOUT_MS       = 120_000; // 2 minutes max before forced collapse

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StreamingSession {
  quantumRunId:  string;
  runId:         string;
  projectId:     number;
  paths:         ExecutionPath[];
  totalPaths:    number;
  arrivedPaths:  number;
  collapsedAt?:  number;
  isCollapsed:   boolean;
  earlyCollapse: boolean;
  bestPathId?:   string;
  bestScore:     number;
  partialResult? : AggregatedResult;
}

// ── Session store ─────────────────────────────────────────────────────────────

const _sessions = new Map<string, StreamingSession>();

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "quantum",
    agentName: "streaming-aggregator",
    eventType,
    payload,
    ts:        Date.now(),
  });
}

// ── Partial aggregation (after each arrival) ──────────────────────────────────

function computePartial(session: StreamingSession): AggregatedResult {
  const results      = getAllResults(session.quantumRunId);
  const completedIds: string[] = [];
  const failedIds:    string[] = [];
  const pathScores    = new Map<string, number>();

  for (const [pathId, result] of results) {
    if (result.success && result.verificationPassed) completedIds.push(pathId);
    else                                             failedIds.push(pathId);
  }

  const completedPaths = session.paths.filter(p => completedIds.includes(p.pathId));
  const rankings       = rankPaths(completedPaths, results);
  for (const r of rankings) pathScores.set(r.pathId, r.confidenceScore);

  const completedResults = new Map<string, PathResult>(
    completedIds.map(id => [id, results.get(id)!]),
  );
  const mergeables = findMergeGroups(completedResults);

  return {
    quantumRunId:   session.quantumRunId,
    completedPaths: completedIds,
    failedPaths:    failedIds,
    pathScores,
    mergeables,
  };
}

// ── Early collapse check ──────────────────────────────────────────────────────

function shouldEarlyCollapse(session: StreamingSession, partial: AggregatedResult): boolean {
  if (session.isCollapsed) return false;
  for (const [pathId, score] of partial.pathScores) {
    if (score >= EARLY_COLLAPSE_THRESHOLD) {
      session.bestPathId = pathId;
      session.bestScore  = score;
      return true;
    }
  }
  return false;
}

// ── Collapse ──────────────────────────────────────────────────────────────────

function collapse(session: StreamingSession, partial: AggregatedResult, reason: "early" | "complete" | "timeout"): void {
  if (session.isCollapsed) return;

  session.isCollapsed   = true;
  session.collapsedAt   = Date.now();
  session.earlyCollapse = reason === "early";
  session.partialResult = partial;

  const ranked = Array.from(partial.pathScores.entries()).sort(([, a], [, b]) => b - a);
  session.bestPathId = session.bestPathId ?? ranked[0]?.[0];
  session.bestScore  = session.bestScore  ?? ranked[0]?.[1] ?? 0;

  emit(session.runId, session.projectId, "streaming.collapsed", {
    reason,
    winnerPathId:  session.bestPathId,
    winnerScore:   session.bestScore,
    completedPaths: partial.completedPaths.length,
    failedPaths:   partial.failedPaths.length,
    arrivedPaths:  session.arrivedPaths,
    totalPaths:    session.totalPaths,
  });

  incrementCounter("quantum.streaming.collapsed", { reason });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Start a streaming aggregation session for a quantum run. */
export function startStreamingSession(
  quantumRunId: string,
  runId:        string,
  projectId:    number,
  paths:        ExecutionPath[],
  timeoutMs:    number = DEFAULT_TIMEOUT_MS,
): StreamingSession {
  const session: StreamingSession = {
    quantumRunId, runId, projectId, paths,
    totalPaths:   paths.length,
    arrivedPaths: 0,
    isCollapsed:  false,
    earlyCollapse: false,
    bestScore:    0,
  };
  _sessions.set(quantumRunId, session);

  emit(runId, projectId, "streaming.session.started", { quantumRunId, totalPaths: paths.length, timeoutMs });

  // Force collapse on timeout even if not all paths have reported
  setTimeout(() => {
    const s = _sessions.get(quantumRunId);
    if (s && !s.isCollapsed) {
      const partial = computePartial(s);
      collapse(s, partial, "timeout");
    }
  }, timeoutMs);

  return session;
}

/**
 * Report a completed path result.
 * Triggers partial aggregation, emits frontend update, and checks for early collapse.
 */
export function reportPathResult(
  quantumRunId: string,
  result:       PathResult,
): void {
  const session = _sessions.get(quantumRunId);
  if (!session || session.isCollapsed) return;

  // Record into the shared result store
  recordPathResult(quantumRunId, result);
  session.arrivedPaths++;

  const partial = computePartial(session);
  session.partialResult = partial;

  emit(session.runId, session.projectId, "streaming.path.arrived", {
    pathId:        result.pathId,
    success:       result.success,
    arrivedPaths:  session.arrivedPaths,
    totalPaths:    session.totalPaths,
    completedPaths: partial.completedPaths.length,
    topScore:      Math.max(0, ...partial.pathScores.values()),
  });

  // Early collapse if a path hits the confidence threshold
  if (shouldEarlyCollapse(session, partial)) {
    collapse(session, partial, "early");
    return;
  }

  // Final collapse when all paths have reported
  if (session.arrivedPaths >= session.totalPaths) {
    collapse(session, partial, "complete");
  }
}

/** Get the current session state. */
export function getStreamingSession(quantumRunId: string): StreamingSession | undefined {
  return _sessions.get(quantumRunId);
}

/** Get the final aggregated result (only available after collapse). */
export function getFinalResult(quantumRunId: string): AggregatedResult | undefined {
  return _sessions.get(quantumRunId)?.partialResult;
}

/** Clean up session after use. */
export function clearStreamingSession(quantumRunId: string): void {
  _sessions.delete(quantumRunId);
}
