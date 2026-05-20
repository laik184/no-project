/**
 * orchestration-state.ts
 *
 * Manages the lifecycle state machine for each orchestration run.
 * Tracks phase history, error log, retry count, and scoring.
 * Emits phase transitions as typed events.
 */

import {
  emitPhaseTransition,
  emitOrchestrationLifecycle,
} from "./orchestration-events.ts";
import type {
  OrchestrationState,
  OrchestrationPhase,
  OrchestrationStatus,
  OrchestrationMode,
  PhaseRecord,
  ErrorRecord,
} from "./orchestration-types.ts";

// ── Valid transitions ─────────────────────────────────────────────────────────

const TRANSITIONS: Partial<Record<OrchestrationPhase, OrchestrationPhase[]>> = {
  observe:    ["analyze", "failed", "cancelled"],
  analyze:    ["plan", "failed", "cancelled"],
  plan:       ["decompose", "execute", "failed", "cancelled"],
  decompose:  ["route", "failed", "cancelled"],
  route:      ["execute", "failed", "cancelled"],
  execute:    ["verify", "heal", "failed", "cancelled"],
  verify:     ["reflect", "heal", "failed", "cancelled"],
  reflect:    ["score", "failed", "cancelled"],
  score:      ["learn", "complete", "failed"],
  learn:      ["complete", "failed"],
  heal:       ["execute", "verify", "failed", "cancelled"],
  complete:   [],
  failed:     ["heal"],
  cancelled:  [],
};

// ── State registry ────────────────────────────────────────────────────────────

const _states = new Map<string, OrchestrationState>();

// ── Factory ───────────────────────────────────────────────────────────────────

export function createState(opts: {
  runId:     string;
  projectId: number;
  mode:      OrchestrationMode;
}): OrchestrationState {
  const state: OrchestrationState = {
    runId:        opts.runId,
    projectId:    opts.projectId,
    phase:        "observe",
    status:       "pending",
    mode:         opts.mode,
    startedAt:    Date.now(),
    updatedAt:    Date.now(),
    retryCount:   0,
    phaseHistory: [],
    errorLog:     [],
  };
  _states.set(opts.runId, state);
  return state;
}

// ── Accessors ─────────────────────────────────────────────────────────────────

export function getState(runId: string): OrchestrationState | undefined {
  return _states.get(runId);
}

export function requireState(runId: string): OrchestrationState {
  const s = _states.get(runId);
  if (!s) throw new Error(`[orchestration-state] No state for runId=${runId}`);
  return s;
}

// ── Transitions ───────────────────────────────────────────────────────────────

export function transitionPhase(
  runId:    string,
  next:     OrchestrationPhase,
  notes?:   string,
): boolean {
  const state = _states.get(runId);
  if (!state) return false;

  const allowed = TRANSITIONS[state.phase] ?? [];
  if (!allowed.includes(next)) {
    console.warn(`[orchestration-state] Invalid transition ${state.phase}→${next} for run ${runId}`);
    return false;
  }

  const prev = state.phase;
  const now  = Date.now();

  // Close current phase record
  const current = state.phaseHistory.find(p => p.phase === prev && !p.exitedAt);
  if (current) {
    current.exitedAt   = now;
    current.durationMs = now - current.enteredAt;
    current.outcome    = "success";
    if (notes) current.notes = notes;
  }

  // Open new phase record
  state.phaseHistory.push({
    phase:     next,
    enteredAt: now,
    outcome:   "pending",
  });

  state.phase     = next;
  state.updatedAt = now;

  if (next === "complete" || next === "failed" || next === "cancelled") {
    state.status       = next === "complete" ? "completed" : next as OrchestrationStatus;
    state.completedAt  = now;
  } else {
    state.status = "running";
  }

  emitPhaseTransition({
    runId,
    projectId:  state.projectId,
    phase:      next,
    prevPhase:  prev,
    outcome:    "success",
    durationMs: current?.durationMs ?? 0,
    notes,
  });

  return true;
}

export function markStatus(runId: string, status: OrchestrationStatus): void {
  const state = _states.get(runId);
  if (!state) return;
  state.status    = status;
  state.updatedAt = Date.now();

  if (status === "completed" || status === "failed" || status === "cancelled") {
    state.completedAt = Date.now();
    emitOrchestrationLifecycle({
      runId,
      projectId: state.projectId,
      phase:     state.phase,
      status,
      mode:      state.mode,
      traceId:   runId,
      durationMs: state.completedAt - state.startedAt,
      score:     state.score,
    });
  }
}

export function recordError(runId: string, err: Omit<ErrorRecord, "ts">): void {
  const state = _states.get(runId);
  if (!state) return;
  state.errorLog.push({ ...err, ts: Date.now() });
  state.updatedAt = Date.now();
}

export function incrementRetry(runId: string): number {
  const state = _states.get(runId);
  if (!state) return 0;
  state.retryCount++;
  state.updatedAt = Date.now();
  return state.retryCount;
}

export function setScore(runId: string, score: number): void {
  const state = _states.get(runId);
  if (!state) return;
  state.score     = Math.max(0, Math.min(1, score));
  state.updatedAt = Date.now();
}

export function setCheckpoint(runId: string, checkpointId: string): void {
  const state = _states.get(runId);
  if (!state) return;
  state.checkpointId = checkpointId;
  state.updatedAt    = Date.now();
}

export function clearState(runId: string): void {
  _states.delete(runId);
}

export function allStates(): OrchestrationState[] {
  return Array.from(_states.values());
}
